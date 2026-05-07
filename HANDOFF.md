# Origin Agent Bounty Hunter — Developer Handoff

> Last updated: 2026-05-06  
> Status: Core engine complete. UI wiring has one known bug. Real x402 and AWS not connected.

---

## What This Project Is

A live competitive agent bounty arena. A user posts a USDC bounty. Five algorithm-bound AI agents race to answer it. Optimus, a deterministic orchestrator, audits every agent for algorithm compliance, scores them, selects a winner, pays them via x402, and publishes a verifiable proof to Base Sepolia.

**Core thesis:**  
x402 gives autonomous agents the ability to pay.  
Origin gives autonomous agents the ability to compete, prove who deserved payment, and build reputation from verified work.

---

## Repository Layout

```
origin-agent-bounty-hunter/
├── apps/
│   ├── api/                    Backend — Express, SSE, agents, Optimus
│   │   └── src/
│   │       ├── server.ts           Express entry point (port 3001)
│   │       ├── routes/             REST endpoints
│   │       │   ├── bounties.ts     POST/GET bounties, SSE, start, replay
│   │       │   ├── paidData.ts     x402-gated /paid-data/defi/protocols
│   │       │   ├── strategyStats.ts GET /api/strategy-stats
│   │       │   ├── health.ts       GET /api/health
│   │       │   └── dev.ts          POST /api/dev/reset (demo only)
│   │       ├── sse/
│   │       │   └── raceStream.ts   SSE emitter + event buffer
│   │       ├── services/
│   │       │   └── raceEngine.ts   Main orchestrator — runs the full race
│   │       ├── agents/             Five algorithm-bound agents
│   │       │   ├── types.ts        AgentRuntime interface
│   │       │   ├── scout.ts        BFS agent (~22s submit)
│   │       │   ├── drill.ts        DFS agent (~40s submit)
│   │       │   ├── compass.ts      A* agent (~28s, demo winner)
│   │       │   ├── dice.ts         Monte Carlo agent (~32s)
│   │       │   └── dash.ts         Greedy agent (~8s, first to submit)
│   │       ├── optimus/            Orchestrator modules (all deterministic)
│   │       │   ├── classifier.ts   Rules-based problem type classifier
│   │       │   ├── auditor.ts      Deterministic constraint auditor
│   │       │   ├── scorer.ts       7-dimension scorer
│   │       │   ├── judger.ts       Winner selection
│   │       │   ├── explainer.ts    Verdict explanation (Bedrock stub)
│   │       │   ├── payer.ts        x402 winner payment
│   │       │   └── strategyMemory.ts  Wins/losses/DQ tracker
│   │       ├── payments/
│   │       │   ├── x402Adapter.ts  Adapter interface
│   │       │   ├── localAdapter.ts Demo payment simulation (default)
│   │       │   └── realAdapter.ts  Real x402 stub (TODO)
│   │       ├── storage/
│   │       │   ├── index.ts        StorageAdapter interface + factory
│   │       │   ├── localFileStorage.ts  In-memory storage (demo default)
│   │       │   └── dynamoAdapter.ts     DynamoDB stub (TODO)
│   │       ├── data/
│   │       │   └── defiData.ts     DefiLlama live fetch + fixture fallback
│   │       ├── proof/
│   │       │   ├── verdictHasher.ts  SHA-256 canonical verdict hash
│   │       │   └── chainPublisher.ts Base Sepolia contract publisher (stub)
│   │       └── replay/
│   │           └── replayEngine.ts  Event replay at 50% speed
│   │
│   └── web/                    Frontend — Vite + React + Tailwind + Framer Motion
│       └── src/
│           ├── App.tsx             3-view router: launcher → arena → verdict
│           ├── types.ts            Frontend type definitions
│           ├── lib/api.ts          Typed API client
│           ├── hooks/
│           │   └── useBountySSE.ts SSE consumer hook
│           └── components/
│               ├── BountyLauncher.tsx  Bounty creation form
│               ├── Arena.tsx           Live race view (SSE-driven)
│               ├── AgentCard.tsx       Per-agent status card
│               ├── OptimusPanel.tsx    Classification + audit sidebar
│               ├── Leaderboard.tsx     Live score ranking
│               ├── PaymentFlow.tsx     x402 payment animation
│               ├── ProofReceipt.tsx    Verdict hash display
│               ├── VerdictReceipt.tsx  Final verdict view
│               ├── StrategyMemory.tsx  Reputation leaderboard
│               ├── ScoreBar.tsx        Score dimension bars
│               └── ArchitectureView.tsx System diagram
│
├── packages/
│   ├── shared/                 Shared TypeScript types, Zod schemas, SSE events
│   │   └── src/
│   │       ├── types.ts        All data types
│   │       ├── events.ts       All 24 SSE event types
│   │       ├── schemas.ts      Zod validation schemas
│   │       └── index.ts        Re-exports
│   │
│   ├── payment-client/         Agent-side x402 payment client (Prompt 2) ✅
│   │   ├── src/
│   │   │   ├── client.ts       OriginPaymentClient class (mock + real modes)
│   │   │   ├── types.ts        PaymentReceipt, X402PaymentSpec, FetchResult, errors
│   │   │   ├── wallet.ts       MockWallet (demo) + CdpWallet (real CDP)
│   │   │   ├── receiptStore.ts In-memory receipt store + hashReceipt
│   │   │   ├── dynamoStore.ts  DynamoDB spend tracker (lazy-loaded)
│   │   │   └── index.ts        Re-exports
│   │   └── test/
│   │       └── client.test.ts  7 tests — all passing
│   │
│   └── contracts/              Solidity contracts
│       ├── contracts/
│       │   └── OriginVerdictRegistry.sol  On-chain verdict + reputation storage
│       ├── scripts/
│       │   └── deploy.ts       Hardhat deploy to Base Sepolia
│       └── test/
│           └── OriginVerdictRegistry.test.ts  5 contract tests
│
├── infra/
│   └── cdk/                    AWS CDK stacks (TypeScript)
│       └── lib/
│           ├── webStack.ts     S3 + CloudFront (frontend)
│           ├── dataStack.ts    5 DynamoDB tables
│           ├── sellerDataStack.ts  CloudFront + Lambda@Edge x402 verifier
│           ├── secretsStack.ts Secrets Manager entries
│           └── appStack.ts     ECS Fargate (SSE-compatible API)
│
├── data/
│   ├── fixtures/               Demo DeFi protocol dataset (15 protocols)
│   ├── replays/                Stored race event replays
│   └── verdicts/               Local verdict JSON bundles
│
├── docs/
│   ├── ARCHITECTURE.md         Full technical architecture
│   ├── DEMO_SCRIPT.md          Judge walkthrough script
│   ├── PITCH.md                Hackathon pitch narrative
│   ├── SETUP.md                Real-mode setup instructions
│   └── JUDGING_CHECKLIST.md    Criteria → code mapping
│
├── CLAUDE.md                   AI assistant instructions
├── IMPLEMENTATION_PLAN.md      Original architecture plan
├── HANDOFF.md                  This file
├── .env.example                All environment variables documented
└── README.md                   Full project README
```

---

## What Is Built and Working

### Backend (apps/api) — COMPLETE

| Module | Status | Notes |
|--------|--------|-------|
| Express server + CORS | ✅ Working | Port 3001 |
| POST /api/bounties | ✅ Working | Creates bounty, returns `{ bounty: { id } }` |
| POST /api/bounties/:id/start | ✅ Working | Triggers race engine |
| GET /api/bounties/:id/events | ✅ Working | SSE stream, real-time |
| GET /api/bounties/:id/verdict | ✅ Working | Returns stored verdict |
| POST /api/bounties/:id/replay | ✅ Working | Replays events at 50% speed |
| GET /api/strategy-stats | ✅ Working | Returns memory leaderboard |
| GET /paid-data/defi/protocols | ✅ Working | Returns 402 challenge without X-PAYMENT header |
| GET /api/health | ✅ Working | Health check |
| POST /api/dev/reset | ✅ Working | Clears in-memory storage |
| Race engine (raceEngine.ts) | ✅ Working | Full 40-second race with all 18 steps |
| SSE event stream | ✅ Working | All 24 event types emitted correctly |
| All 5 agents | ✅ Working | Each runs different algorithm with realistic timing |
| Optimus classifier | ✅ Working | Rules-based, no LLM |
| Optimus auditor | ✅ Working | Deterministic per-algorithm checks |
| Optimus scorer | ✅ Working | 7-dimension, 100-point scale |
| Optimus judger | ✅ Working | Picks winner by score, tiebreaks by speed |
| Optimus payer | ✅ Working | Calls x402 adapter, emits payment events |
| Strategy memory | ✅ Working | Updates after every race |
| Verdict hash (SHA-256) | ✅ Working | Canonical JSON hash |
| Demo DeFi fixture data | ✅ Working | 15 protocols; x402 fetch via PAID_DATA_URL when set |
| x402 payment client | ✅ Working | packages/payment-client, 7/7 tests pass |
| Local storage (in-memory) | ✅ Working | No file I/O, fast |
| x402 demo adapter | ✅ Working | Simulates full challenge/sign/settle flow |

### Frontend (apps/web) — BUILT, ONE BUG

| Component | Status | Notes |
|-----------|--------|-------|
| BountyLauncher | ✅ Renders | Form submit has bug (see Known Bugs below) |
| Arena | ✅ Built | SSE-driven live race view |
| AgentCard | ✅ Built | Status, progress, audit checks, score |
| OptimusPanel | ✅ Built | Classification + audit sidebar |
| Leaderboard | ✅ Built | Live ranking with AnimatePresence |
| PaymentFlow | ✅ Built | Animated x402 steps |
| ProofReceipt | ✅ Built | Verdict hash + chain status |
| VerdictReceipt | ✅ Built | Full verdict + replay + new bounty |
| StrategyMemory | ✅ Built | Per-agent win/loss/avg score |
| ArchitectureView | ✅ Built | CSS system diagram |
| useBountySSE hook | ✅ Built | SSE consumer with cleanup |
| Framer Motion animations | ✅ Built | Entrance, progress, winner glow, DQ shake |
| Dark cinematic theme | ✅ Built | JetBrains Mono, indigo/cyan palette |

### Contracts (packages/contracts) — BUILT, NOT DEPLOYED

| Item | Status | Notes |
|------|--------|-------|
| OriginVerdictRegistry.sol | ✅ Written | publishVerdict, updateReputation, views, events |
| Duplicate verdict prevention | ✅ Written | Reverts on same bountyId |
| Publisher ACL | ✅ Written | Owner + authorized publishers |
| Hardhat config | ✅ Written | Base Sepolia (chainId 84532) |
| Deploy script | ✅ Written | Prints contract address |
| Contract tests (5 tests) | ✅ Written | Not run yet (need `npm install` in contracts/) |
| Actual deployment | ❌ Not done | Needs VERDICT_PRIVATE_KEY + funded wallet |

### AWS CDK (infra/cdk) — SKELETON ONLY

| Stack | Status | Notes |
|-------|--------|-------|
| webStack | ✅ Skeleton | S3 + CloudFront defined |
| dataStack | ✅ Skeleton | 5 DynamoDB tables defined |
| sellerDataStack | ✅ Skeleton | CloudFront + Lambda@Edge x402 verifier stubbed |
| secretsStack | ✅ Skeleton | Secrets Manager placeholders |
| appStack | ✅ Skeleton | ECS Fargate defined, WHY-NOT-LAMBDA documented |
| Deployed to AWS | ❌ Not done | Needs AWS credentials + cdk bootstrap |

---

## Known Bugs

### Bug 1: Frontend form → arena transition (CRITICAL)
**File:** `apps/web/src/lib/api.ts`  
**Symptom:** Clicking "Start Bounty" shows "HTTP 404" error. The arena never appears.  
**Root cause:** The `createBounty` function returns `{ bounty: { id }, paymentRequired, demoMode }`. The `BountyLauncher.tsx` calls `bounty.bountyId` which is `undefined`. This calls `POST /api/bounties/undefined/start` → 404.  
**Status of fix:** Fix is in `apps/web/src/lib/api.ts` (normalizes response to include `bountyId` at top level) but Vite module cache may serve old compiled version.  
**Fix to apply:**
```typescript
// In apps/web/src/lib/api.ts — createBounty function should end with:
const body = await res.json();
return { bountyId: body.bounty?.id ?? body.bountyId, ...body };
```
Then restart the Vite dev server (`pkill -f vite && cd apps/web && npm run dev`).  
**Alternatively:** Fix `BountyLauncher.tsx` directly:
```typescript
// Change:
await startBounty(bounty.bountyId);
onStart(bounty.bountyId);
// To:
const bountyId = bounty.bountyId ?? bounty.bounty?.id;
await startBounty(bountyId);
onStart(bountyId);
```

**Verification:** After fix, clicking Start Bounty should transition to the arena view and show all 5 agent cards running in real time. The backend race engine is confirmed working — the bug is purely in the frontend ID extraction.

---

## What Is Missing / Not Connected

### 1. Real x402 Payment Integration

**What we have:** A full x402 adapter interface + local demo simulation. All SSE events fire correctly. The architecture is correct.

**What's needed to go real:**

```bash
# Install real x402 packages
cd apps/api
npm install x402-express x402-fetch @coinbase/x402

# Set in .env:
X402_FACILITATOR_URL=https://facilitator.x402.org
CDP_API_KEY_ID=your-cdp-key-id
CDP_API_KEY_SECRET=your-cdp-key-secret
CDP_WALLET_SECRET=your-wallet-secret
DEMO_MODE=false
```

**Files to update:**
- `apps/api/src/payments/realAdapter.ts` — implement `createChallenge`, `verifyPayment`, `payEndpoint` using the x402 packages
- `apps/api/src/routes/paidData.ts` — replace the manual header check with `x402-express` middleware
- `apps/api/src/payments/x402Adapter.ts` — update `getX402Adapter()` to return `RealX402Adapter` when `DEMO_MODE=false`

**Reference implementations:**
- Seller side: https://github.com/coinbase/x402/tree/main/examples/typescript/servers
- Buyer side: https://github.com/coinbase/x402/tree/main/examples/typescript/clients
- AWS reference: https://github.com/aws-samples/sample-agentcore-cloudfront-x402-payments

---

### 2. Base Sepolia Contract Deployment

**What we have:** Full Solidity contract + deploy script + 5 tests. Chain publisher calls the right function — just needs credentials.

**Steps to deploy:**

```bash
# 1. Get testnet ETH for Base Sepolia
# Faucet: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet
# Or: https://faucet.quicknode.com/base/sepolia

# 2. Set in .env:
VERDICT_PRIVATE_KEY=0xYOUR_PRIVATE_KEY
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org

# 3. Install and deploy
cd packages/contracts
npm install
npm run compile
npm run deploy:sepolia

# 4. Copy printed address to .env:
VERDICT_CONTRACT_ADDRESS=0x...
```

**What to update after deploy:**
- `apps/api/src/proof/chainPublisher.ts` — uncomment the viem call (it's stubbed with TODO comments)
- The `publishVerdict` function in `chainPublisher.ts` needs:
  ```typescript
  import { createWalletClient, http, parseAbi } from 'viem'
  import { baseSepolia } from 'viem/chains'
  import { privateKeyToAccount } from 'viem/accounts'
  ```

---

### 3. AWS Deployment

**What we have:** Full CDK stack definitions. The app uses in-memory storage. DynamoDB adapter is stubbed.

**Steps to deploy:**

```bash
# Prerequisites: AWS account, credentials configured

# 1. Install CDK and contracts deps
cd infra/cdk && npm install

# 2. Bootstrap CDK (once per account/region)
npx cdk bootstrap aws://ACCOUNT_ID/us-east-1

# 3. Deploy all stacks
npx cdk deploy --all

# 4. Build and push Docker image for API
cd apps/api && npm run build
aws ecr get-login-password | docker login --username AWS --password-stdin ACCOUNT.dkr.ecr.REGION.amazonaws.com
docker build -t origin-api .
docker tag origin-api:latest ACCOUNT.dkr.ecr.REGION.amazonaws.com/origin-api:latest
docker push ACCOUNT.dkr.ecr.REGION.amazonaws.com/origin-api:latest
```

**What to update:**
- `apps/api/src/storage/dynamoAdapter.ts` — implement all methods using `@aws-sdk/lib-dynamodb`
- `apps/api/src/storage/index.ts` — return `DynamoStorageAdapter` when `AWS_REGION` is set
- `apps/api/src/optimus/explainer.ts` — implement Bedrock call when `BEDROCK_REGION` is set
- Add a `Dockerfile` to `apps/api/`

---

### 4. Bedrock Explanation

**What we have:** A stub in `apps/api/src/optimus/explainer.ts` that falls back to a deterministic template.

**To enable:**
```bash
# Set in .env:
BEDROCK_REGION=us-east-1
```
Then update `explainer.ts` to call:
```typescript
import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime"
// Call claude-3-sonnet or claude-3-haiku with the verdict context
// Model: anthropic.claude-3-haiku-20240307-v1:0
```

---

### 5. Live DeFi Data

**What we have:** `apps/api/src/data/defiData.ts` tries `https://api.llama.fi/protocols` first, falls back to 15-protocol fixture.

**To improve:**
- Add retry logic with exponential backoff
- Cache successful responses to disk (`data/fixtures/defi-latest.json`)
- Filter to top 20 by TVL from DefiLlama response
- Add more fields: audit status, age, exploits history

---

### 6. Contract Tests Not Run

```bash
cd packages/contracts
npm install
npx hardhat compile
npx hardhat test
```

Expected: all 5 tests pass (publish, duplicate prevention, reputation, unauthorized rejection, authorized publisher).

---

### 7. Agent Disqualification Demo

**What we have:** All agents pass audit in default demo mode. `DEMO_DISQUALIFY_AGENT` env var can force a failure.

**To demo disqualification:**
```bash
DEMO_DISQUALIFY_AGENT=drill npm run dev
```
This sets Drill's `maxDepthReached = 2` (below minimum of 3), causing audit failure and disqualification.

---

## How to Run (Local Demo)

```bash
# 1. Clone and setup
cd origin-agent-bounty-hunter
cp .env.example .env
npm install

# 2. Start backend (terminal 1)
cd apps/api
npm run dev
# → Server on http://localhost:3001

# 3. Start frontend (terminal 2)
cd apps/web
npm run dev
# → UI on http://localhost:5173

# 4. Open browser at http://localhost:5173
# 5. Click "Start Bounty"
# 6. Watch the 40-second live race
```

**Or both at once from root:**
```bash
npm run dev
```

---

## Environment Variables Reference

```bash
# ── Core ──
DEMO_MODE=true              # false = enables real x402 + AWS
PORT=3001

# ── Demo options ──
DEMO_DISQUALIFY_AGENT=      # drill | dice | dash — forces audit failure

# ── x402 (real mode) ──
X402_FACILITATOR_URL=       # https://facilitator.x402.org
CDP_API_KEY_ID=
CDP_API_KEY_SECRET=
CDP_WALLET_SECRET=

# ── Base Sepolia ──
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
VERDICT_PRIVATE_KEY=        # Funded wallet private key
VERDICT_CONTRACT_ADDRESS=   # After: npm run deploy:sepolia
BASESCAN_API_KEY=           # For verification (optional)

# ── AWS ──
AWS_REGION=us-east-1
BEDROCK_REGION=us-east-1
DYNAMODB_TABLE_PREFIX=origin-prod-

# ── Seller data endpoint ──
PAID_DATA_SELLER_WALLET=0x...
```

---

## API Contract Reference

### POST /api/bounties
**Request:**
```json
{
  "title": "string (10-200 chars)",
  "description": "string (20-2000 chars)",
  "budgetUsdc": 2,
  "timeLimitSeconds": 90
}
```
**Response:**
```json
{
  "bounty": { "id": "uuid", "title": "...", "status": "created", ... },
  "paymentRequired": false,
  "demoMode": true
}
```
**Note:** Extract bounty ID as `response.bounty.id`.

### POST /api/bounties/:id/start
**Response:** `{ "started": true, "bountyId": "uuid" }`

### GET /api/bounties/:id/events
**SSE stream.** Each message: `data: { id, bountyId, type, timestamp, payload }\n\n`  
See `packages/shared/src/events.ts` for all 24 event type definitions.

### GET /paid-data/defi/protocols
- Without `X-PAYMENT` header → `402 { paymentRequired: true, challenge: {...} }`
- With `X-PAYMENT: demo-signed-*` → `200 { protocols: [...], source: "DEMO_FIXTURE" }`

---

## SSE Event Sequence (Normal Race)

```
bounty.created
bounty.payment_required      (if DEMO_MODE=false)
bounty.payment_verified      (if DEMO_MODE=false)
optimus.classifying          (~1s)
optimus.classified           (~2s) → { problemType, expectedWinnerAgentId, confidence }
bounty.dispatched            (~2s)
agent.queued × 5             (~2s)
agent.running × 5            (~3s, simultaneous)
agent.progress × N           (continuous, each agent)
agent.submitted: dash        (~8s)
agent.submitted: scout       (~22s)
agent.submitted: compass     (~28s)
agent.submitted: dice        (~32s)
agent.submitted: drill       (~40s)
agent.audit_started × 5
agent.audit_passed/failed × 5
agent.scored × 5
optimus.judging
optimus.verdict              → { winnerAgentId: "compass", ... }
payment.started
payment.challenge
payment.settled
proof.hash_created           → { verdictHash: "sha256hex" }
proof.onchain_published      (if VERDICT_PRIVATE_KEY set)
strategy_memory.updated      → { stats: [...] }
bounty.completed             → { verdict: {...} }
```

---

## Scoring Rubric (Built Into scorer.ts)

| Dimension | Max Points | Logic |
|-----------|-----------|-------|
| Constraint Compliance | 20 | Audit passed=20, partial=8, disqualified=0 |
| Answer Quality | 20 | Top 3 protocols with name/TVL/recommendation |
| Methodology Fit | 18 | Algorithm matches problem type |
| Evidence Quality | 15 | Reasoning trace depth and specificity |
| Coverage/Depth | 12 | BFS/A* rewarded for breadth, DFS for depth |
| Reasoning Clarity | 10 | Summary + methodology text quality |
| Speed Efficiency | 5 | <10s=5pts, <20s=4pts, <30s=3pts, <40s=2pts |
| **Total** | **100** | Disqualification overrides everything |

---

## Agent Algorithm Specs (Audit Rules)

| Agent | Algorithm | Disqualify If |
|-------|-----------|---------------|
| Scout | BFS | `breadthRequirementMet === false` OR `nodesVisited.length < 8` |
| Drill | DFS | `maxDepthReached < 3` |
| Compass | A* | `heuristicVersion` empty |
| Dice | Monte Carlo | `sampleCount < 10` |
| Dash | Greedy | `backtrackCount > 0` |

---

## Priority TODO List for Next Developer

**Priority 1 — Fix the demo (30 min)**
- [ ] Fix frontend form → arena transition bug (see Bug 1 above)
- [ ] Verify full race visible in browser with agent cards
- [ ] Verify verdict + strategy memory display after race

**Priority 2 — Real x402 (1-2 hours, client is done)**
- [x] `packages/payment-client` — OriginPaymentClient built, 7/7 tests pass (MOCK_X402=true)
- [x] `apps/api/src/data/defiData.ts` — calls payment client when `PAID_DATA_URL` is set
- [ ] Set `PAID_DATA_URL` + `CDP_API_KEY_NAME` + `CDP_API_KEY_PRIVATE_KEY` + `AGENT_WALLET_SEED` in `.env`
- [ ] Fund agent wallet on Base Sepolia with test USDC from https://faucet.circle.com
- [ ] Set `DEMO_MODE=false` + `MOCK_X402=false` and run a real bounty end-to-end
- [ ] Implement `apps/api/src/payments/realAdapter.ts` for winner-side payments

**Priority 3 — Base Sepolia (1-2 hours)**
- [ ] Install contracts deps and run tests
- [ ] Deploy contract to Base Sepolia
- [ ] Implement viem call in `chainPublisher.ts`
- [ ] Verify verdict hash appears on-chain

**Priority 4 — AWS (4-8 hours)**
- [ ] Add `Dockerfile` to `apps/api/`
- [ ] Implement `dynamoAdapter.ts` 
- [ ] Run `cdk bootstrap && cdk deploy`
- [ ] Push container to ECR, wire ECS task definition
- [ ] Enable Bedrock explanation in `explainer.ts`

**Priority 5 — Polish (1-2 hours)**
- [ ] Run `npm run test` across all packages
- [ ] Add demo disqualification to default demo path
- [ ] Add loading skeleton to AgentCard while race starts
- [ ] Add confetti or sound on winner announcement

---

## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Frontend | Vite + React 18 + TypeScript + Tailwind CSS + Framer Motion |
| Backend | Node.js + Express + TypeScript + tsx (hot reload) |
| Validation | Zod (shared schemas) |
| Real-time | Server-Sent Events (SSE) |
| Storage (demo) | In-memory Maps |
| Storage (prod) | DynamoDB (stubbed) |
| Payments (demo) | Local adapter |
| Payments (prod) | x402 + Coinbase CDP (stubbed) |
| Blockchain | Solidity 0.8.24 + Hardhat + Base Sepolia |
| Chain client | viem (in chainPublisher.ts) |
| AI explanation | Bedrock (stubbed, deterministic fallback works) |
| Infrastructure | AWS CDK v2 TypeScript (ECS, S3, CloudFront, DynamoDB, Secrets Manager) |
| Monorepo | npm workspaces |

---

## Contacts / References

- x402 protocol: https://github.com/coinbase/x402
- x402 docs: https://docs.cdp.coinbase.com/x402/core-concepts/http-402
- Coinbase AgentKit: https://docs.cdp.coinbase.com/agent-kit/getting-started/quickstart
- AWS AgentCore + x402 sample: https://github.com/aws-samples/sample-agentcore-cloudfront-x402-payments
- Base Sepolia faucet: https://www.coinbase.com/faucets/base-ethereum-goerli-faucet
- Base Sepolia explorer: https://sepolia.basescan.org
- DefiLlama API: https://api.llama.fi/protocols
