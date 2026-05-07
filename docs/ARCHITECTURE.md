# Origin — Technical Architecture

## System Overview

Origin consists of five main subsystems:

1. **Web UI** — Next.js frontend; consumes the API via SSE for live updates
2. **Origin API** — Express server; orchestrates bounties, agents, scoring, payments
3. **Agent Runner** — Five concurrent TypeScript agents, each with its own CDP wallet
4. **Optimus Judge** — AI scoring service backed by Amazon Bedrock (Claude)
5. **OriginVerdictRegistry** — Solidity contract on Base Sepolia for on-chain proofs

---

## Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Client Browser                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  Next.js Web UI                                                  │   │
│  │  - POST /bounty           (fund & create)                        │   │
│  │  - GET  /bounty/:id/stream (SSE — live scoring)                  │   │
│  │  - GET  /leaderboard      (reputation view)                      │   │
│  └──────────────────────────────┬───────────────────────────────────┘   │
└─────────────────────────────────┼───────────────────────────────────────┘
                                  │  HTTPS
                        ┌─────────▼──────────┐
                        │  CloudFront (Web)   │
                        │  S3 Origin (OAC)    │
                        └─────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  AWS VPC (us-east-1)                                                     │
│                                                                          │
│  Internet → ALB (port 80) → ECS Fargate Task (port 3001)               │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Origin API  (Express + TypeScript)                               │  │
│  │                                                                   │  │
│  │  Routes:                                                          │  │
│  │    POST /bounty          → BountyService                         │  │
│  │    GET  /bounty/:id      → BountyService                         │  │
│  │    GET  /bounty/:id/stream → SSE stream (AgentRunner)            │  │
│  │    GET  /leaderboard     → ReputationService                     │  │
│  │    GET  /health          → { status: ok }                        │  │
│  │                                                                   │  │
│  │  Services:                                                        │  │
│  │    BountyService    — create, store, retrieve bounties            │  │
│  │    AgentRunner      — spawn 5 agents, collect solutions           │  │
│  │    OptimusService   — call Bedrock, produce scored verdict        │  │
│  │    PayoutService    — AgentKit USDC transfer to winner            │  │
│  │    VerdictService   — publish verdict hash to Base Sepolia        │  │
│  │    ReputationService — read on-chain + DynamoDB reputation data   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  AWS DynamoDB                  AWS Secrets Manager                       │
│    OriginBounties                origin/CDP_API_KEY_ID                   │
│    OriginSubmissions             origin/CDP_API_KEY_SECRET               │
│    OriginVerdicts                origin/CDP_WALLET_SECRET                │
│    OriginStrategyStats           origin/VERDICT_PRIVATE_KEY              │
│    OriginAgentReputation         origin/BASE_SEPOLIA_RPC_URL             │
│                                  origin/X402_FACILITATOR_URL             │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  Agent Layer  (runs inside the API process, one goroutine per agent)    │
│                                                                          │
│   Scout  (BFS)        Coinbase CDP Wallet A                             │
│   Drill  (DFS)        Coinbase CDP Wallet B   ──► x402 data purchase    │
│   Compass (A*)        Coinbase CDP Wallet C   ──► x402 data purchase    │
│   Dice  (Monte Carlo) Coinbase CDP Wallet D                             │
│   Dash  (Greedy)      Coinbase CDP Wallet E                             │
│                                                                          │
│   x402 data seller endpoint (CloudFront):                               │
│   ┌─────────────────────────────────────────────────────────────┐       │
│   │  CloudFront → Lambda@Edge (x402 verify) → S3 (datasets)    │       │
│   └─────────────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  External Services                                                       │
│                                                                          │
│   Amazon Bedrock (Claude)   — Optimus judge scoring                     │
│   Coinbase CDP / AgentKit   — wallet management + USDC payout           │
│   x402 Facilitator          — payment proof verification                │
│   Base Sepolia RPC          — read/write OriginVerdictRegistry          │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  Base Sepolia (chainId: 84532)                                           │
│                                                                          │
│   OriginVerdictRegistry.sol                                              │
│     publishVerdict(bountyId, verdictHash, winnerAgentId, ...)           │
│     updateReputation(agentWallet, taskType, delta, verdictHash)         │
│     getVerdict(bountyId) → VerdictRecord                                │
│     getAgentReputation(wallet, taskType) → ReputationRecord             │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Bounty Lifecycle

```
1. FUND & POST
   Client → POST /bounty
          → BountyService creates record in DynamoDB (status=open)
          → x402 adapter verifies payment from poster wallet
          → status=funded

2. SOLVE (parallel, SSE stream)
   AgentRunner spawns 5 agent goroutines
   Each agent:
     a. Reads problem from DynamoDB
     b. Optionally: sends x402 micropayment → CloudFront seller endpoint
                    → Lambda@Edge verifies → S3 returns enriched data
     c. Runs its algorithm (BFS / DFS / A* / Monte Carlo / Greedy)
     d. Writes submission to DynamoDB (OriginSubmissions)
     e. Emits SSE event: { agentId, status, nodeCount, elapsed }
   Audit check runs concurrently; failed agents are disqualified

3. SCORE
   OptimusService collects all non-disqualified submissions
   Calls Bedrock Claude with structured prompt:
     - problem definition
     - all submissions (solutions + reasoning)
     - 7-dimension rubric
   Receives JSON score breakdown + winner determination
   Stores verdict in DynamoDB (OriginVerdicts)

4. PUBLISH ON-CHAIN
   VerdictService:
     verdictHash = keccak256(JSON.stringify(verdict))
     calls OriginVerdictRegistry.publishVerdict(...)
     calls OriginVerdictRegistry.updateReputation(winner, +10)
     calls OriginVerdictRegistry.updateReputation(losers, -1 each)
     Emits SSE event: { txHash, contractAddress }

5. PAY OUT
   PayoutService:
     uses AgentKit to transfer prizePool USDC to winnerWallet
     Emits SSE event: { payoutTxHash, amount, recipient }
     bounty status=complete

6. REPUTATION UPDATE
   ReputationService reads from DynamoDB + on-chain state
   Leaderboard API returns merged view
```

---

## x402 Payment Detail

### Flow B — Agent buys data (detailed)

```
Agent (e.g. Compass)
  │
  ├─ GET https://<seller-cloudfront>/defi-protocols/top-100.json
  │     (no payment header)
  │
  ◄─ 402 Payment Required
  │    { accepts: [{ scheme: "exact", network: "base-sepolia",
  │                  maxAmountRequired: "500000", asset: "usdc" }] }
  │
  ├─ AgentKit: sign x402 payment authorization
  │     amount=500000 (0.50 USDC), to=sellerWallet
  │
  ├─ GET https://<seller-cloudfront>/defi-protocols/top-100.json
  │     X-Payment: <signed-authorization>
  │
  ◄─ Lambda@Edge: verifies X-Payment with facilitator
  │
  ◄─ 200 OK + dataset JSON
```

---

## DynamoDB Table Schema

### OriginBounties
| Attribute | Type | Description |
|-----------|------|-------------|
| bountyId (PK) | S | Unique bounty identifier |
| problemType | S | e.g. `heuristic-structured` |
| problemData | M | Graph adjacency list, start/end nodes |
| prizeUsdc | N | Prize pool in USDC (integer, 6 decimals) |
| status | S | `open` \| `funded` \| `solving` \| `scoring` \| `complete` |
| createdAt | N | Unix timestamp |
| posterWallet | S | Bounty poster wallet address |

### OriginSubmissions
| Attribute | Type | Description |
|-----------|------|-------------|
| bountyId (PK) | S | Parent bounty |
| agentId (SK) | S | Agent identifier |
| solution | M | Path, cost, node visits |
| reasoning | S | Agent's explanation |
| usedPaidData | BOOL | Whether agent bought premium data |
| status | S | `submitted` \| `disqualified` |
| submittedAt | N | Unix timestamp |

### OriginVerdicts
| Attribute | Type | Description |
|-----------|------|-------------|
| bountyId (PK) | S | Bounty this verdict closes |
| winnerAgentId | S | Winning agent ID |
| scores | M | Per-agent score breakdown (7 dimensions) |
| verdictHash | S | keccak256 of verdict JSON (matches on-chain) |
| txHash | S | Base Sepolia transaction hash |
| contractAddress | S | OriginVerdictRegistry address |
| publishedAt | N | Unix timestamp |

### OriginStrategyStats
| Attribute | Type | Description |
|-----------|------|-------------|
| agentId (PK) | S | Agent identifier |
| problemType (SK) | S | Problem category |
| wins | N | Total wins |
| losses | N | Total losses |
| avgScore | N | Rolling average Optimus score |

### OriginAgentReputation
| Attribute | Type | Description |
|-----------|------|-------------|
| agentWalletAddress (PK) | S | Agent's CDP wallet address |
| taskType (SK) | S | Task category |
| reputationDelta | N | Cumulative reputation (mirrors on-chain) |
| totalWins | N | Total wins |
| totalLosses | N | Total losses |
| lastUpdated | N | Unix timestamp |

---

## Smart Contract Architecture

### OriginVerdictRegistry (Base Sepolia)

```
Owner (deployer)
  │
  ├── addPublisher(addr)       Add authorised verdict publisher
  ├── removePublisher(addr)    Remove publisher
  │
  ├── publishVerdict(...)      Write immutable verdict proof
  │     Requires: bountyId not already recorded
  │     Emits: VerdictPublished event
  │
  ├── updateReputation(...)    Increment/decrement agent rep
  │     Emits: ReputationUpdated event
  │
  ├── getVerdict(bountyId)     Read verdict by ID
  └── getAgentReputation(wallet, taskType)  Read reputation
```

Access control: only `owner` or `authorizedPublishers` can write. All reads are public.

---

## Why ECS Fargate (Not Lambda) for the API

The Origin API maintains long-lived SSE connections to push real-time scoring updates to clients. AWS Lambda has a maximum execution time of 15 minutes and does not support streaming responses beyond that window. During a competitive round, clients hold connections open for the entire duration of agent solving + Bedrock scoring, which can exceed Lambda's constraints.

ECS Fargate containers stay alive indefinitely as long as the task is running, making them the correct choice for SSE-based event streaming.

App Runner is an acceptable alternative if you prefer a managed container runtime without configuring an ALB.
