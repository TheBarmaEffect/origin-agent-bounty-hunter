<div align="center">

# ⬡ Origin — Agent Bounty Hunter

### *Real autonomous AI agents · Real x402 micropayments · Real on-chain verdicts*

[![Base Sepolia](https://img.shields.io/badge/Base-Sepolia%20Live-0052FF?logo=coinbase)](https://sepolia.basescan.org/address/0xad6870E90311BB5CA2f03CC16DAa5b447618F56E)
[![x402](https://img.shields.io/badge/x402-Coinbase-FF6B00)](https://github.com/coinbase/x402)
[![CDP AgentKit](https://img.shields.io/badge/Coinbase%20CDP-AgentKit-0052FF)](https://docs.cdp.coinbase.com/agentkit/)
[![Bedrock](https://img.shields.io/badge/Amazon-Bedrock-FF9900?logo=amazon-aws)](https://aws.amazon.com/bedrock/)
[![AWS](https://img.shields.io/badge/AWS-CDK-232F3E?logo=amazon-aws)](https://aws.amazon.com/cdk/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

**[Live UI Showcase →](https://thebarmaeffect.github.io/origin-agent-bounty-hunter/)** &nbsp;·&nbsp; **[Verdict Contract on Base Sepolia →](https://sepolia.basescan.org/address/0xad6870E90311BB5CA2f03CC16DAa5b447618F56E)** &nbsp;·&nbsp; **[Architecture](#architecture)** &nbsp;·&nbsp; **[Run It](#run-it-yourself)**

</div>

---

## What it is

Origin is a **live competitive arena for autonomous AI agents**. Five algorithm-bound agents — each constrained to a different search algorithm — race to solve a user-posted bounty. They **autonomously pay for premium data** using Coinbase's [x402 protocol](https://github.com/coinbase/x402). The winner is paid in **real USDC on Base Sepolia**. **Optimus** — the orchestrating AI judge — classifies the problem, audits each agent's algorithm compliance, scores their answers, settles the payout, and **publishes a tamper-evident verdict hash to a smart contract on Base Sepolia**.

Every transaction in the UI is a real on-chain transaction. Every `↗` link goes to a basescan tx that actually happened. **A single 40-second race produces 8 real Base Sepolia transactions.**

---

## How partner tech is used (judging cheat-sheet)

### 🔵 Coinbase x402 Protocol

> *"HTTP 402 Payment Required, returned by a paywalled API; client signs an EIP-3009 USDC authorization, retries; server verifies via facilitator/RPC and returns the data. The unlock for autonomous agent commerce."*

| Where | Implementation |
|---|---|
| **x402 server** | [`apps/x402-seller/src/handler.ts`](apps/x402-seller/src/handler.ts) — Lambda@Edge handler. Returns HTTP 402 with `x402Version: 1` payment spec on first request; on retry verifies the `x-payment` header. |
| **x402 verification** | [`apps/x402-seller/src/facilitator.ts`](apps/x402-seller/src/facilitator.ts) — verifies signed payment via on-chain RPC (reads tx receipt, checks Transfer log → recipient, asset, amount). Falls back to the hosted Coinbase facilitator. |
| **x402 client** | [`packages/payment-client/src/client.ts`](packages/payment-client/src/client.ts) — `OriginPaymentClient` parses 402 challenges, signs payments via CDP, retries with `x-payment` header. **Each of the 5 agents pays $0.001 USDC per data fetch.** |
| **Live proof** | 5 agent x402 txs per race on Base Sepolia. See [On-chain proof](#on-chain-proof) below. |

### 🔵 Coinbase CDP AgentKit + Server Wallets

> *"Spin up a fresh EVM wallet from API; sign and broadcast transactions programmatically; no seed phrases, no UI clicks. Every agent gets one."*

| Where | Implementation |
|---|---|
| **Wallet provisioning** | [`scripts/setupWallet.ts`](scripts/setupWallet.ts) — `cdp.evm.createAccount()`, `cdp.evm.requestFaucet()` for ETH + USDC. One-shot setup, fully programmatic. |
| **Agent payments (per-fetch)** | [`apps/api/src/payments/cdpPayer.ts`](apps/api/src/payments/cdpPayer.ts) — wraps `account.transfer()`. Each agent pays $0.001 USDC per data fetch via this. |
| **Bounty fund + winner payout** | Same module. User funds escrow → on completion, escrow pays winner. Both real on-chain. |
| **Production-grade auth** | All three CDP credentials wired: `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`, `CDP_WALLET_SECRET`. |

### 🟠 Amazon Bedrock (Claude Sonnet 4.5)

> *"The orchestrator's reasoning. Claude classifies the problem and writes the verdict rationale."*

| Where | Implementation |
|---|---|
| **Verdict generation** | [`apps/api/src/optimus/explainer.ts`](apps/api/src/optimus/explainer.ts) — `BedrockRuntimeClient.send(InvokeModelCommand)`. Sends the full agent submission summary + scores to Claude Sonnet 4.5. The model writes the verdict rationale displayed during the reveal sequence. |
| **Model** | `anthropic.claude-sonnet-4-5-v1:0` (configurable via `BEDROCK_MODEL`). |
| **Graceful fallback** | If `BEDROCK_REGION` is unset, a deterministic high-quality template generates the same shape of explanation — demo never breaks. |

### 🔵 Base Sepolia (L2 + Smart Contract)

> *"Verifiable, public, low-cost rails. Every payment + every verdict hash lives here forever."*

| Where | Implementation |
|---|---|
| **Verdict registry contract** | [`packages/contracts/contracts/OriginVerdictRegistry.sol`](packages/contracts/contracts/OriginVerdictRegistry.sol) — Solidity 0.8.24. Deployed at [`0xad6870E90311BB5CA2f03CC16DAa5b447618F56E`](https://sepolia.basescan.org/address/0xad6870E90311BB5CA2f03CC16DAa5b447618F56E). Stores `VerdictRecord { bountyId, verdictHash (bytes32), winnerAgentId, problemType, payoutAmount, payoutAsset, timestamp, publisher }` per bounty. Duplicate-publish-prevention. Publisher ACL. |
| **Publisher** | [`apps/api/src/proof/chainPublisher.ts`](apps/api/src/proof/chainPublisher.ts) — viem-based. Builds canonical SHA-256 verdict hash, writes via `walletClient.writeContract()`. Verdict is on-chain ~3 seconds after the winner is announced. |
| **USDC** | Real Base Sepolia USDC at `0x036CbD53842c5426634e7929541eC2318f3dCF7e`. All 8 txs per race move real USDC. |

### 🟠 AWS (Bedrock + CDK Infrastructure)

> *"Production-grade infrastructure-as-code. One command stands the whole stack up."*

| Stack | Purpose | File |
|---|---|---|
| **Bedrock** | Claude Sonnet 4.5 verdict reasoning | [`apps/api/src/optimus/explainer.ts`](apps/api/src/optimus/explainer.ts) |
| **ECS Fargate** | API + SSE backend (long-lived connections, not Lambda) | [`infra/cdk/lib/appStack.ts`](infra/cdk/lib/appStack.ts) |
| **S3 + CloudFront** | Frontend distribution | [`infra/cdk/lib/webStack.ts`](infra/cdk/lib/webStack.ts) |
| **Lambda@Edge** | x402-seller payment-gated DeFi data API | [`infra/cdk/lib/sellerDataStack.ts`](infra/cdk/lib/sellerDataStack.ts) |
| **DynamoDB** | 5 tables: bounties, submissions, verdicts, strategy stats, agent reputation | [`infra/cdk/lib/dataStack.ts`](infra/cdk/lib/dataStack.ts) |
| **Secrets Manager** | CDP API keys, wallet secret, verdict private key | [`infra/cdk/lib/secretsStack.ts`](infra/cdk/lib/secretsStack.ts) |

```bash
cd infra/cdk && cdk bootstrap && cdk deploy --all
# stands up the whole production stack
```

---

## On-chain proof

A single race produces these 8 real Base Sepolia transactions:

| # | Action | Sample tx (one race) |
|---|---|---|
| 1 | User funds bounty ($0.50 USDC → escrow) | [`0x3f7915d2…`](https://sepolia.basescan.org/tx/0x3f7915d269ed46d404e01020057eadf3cce7c2e00d14bfdf89436f15b1231582) |
| 2 | Scout (BFS) pays $0.001 USDC for x402 data | [`0xe316eb7e…`](https://sepolia.basescan.org/tx/0xe316eb7e6ede2f77617b72fd31a7d117808d7c139f1f5b08fe3f231e15337046) |
| 3 | Drill (DFS) pays $0.001 USDC for x402 data | [`0x31470ed4…`](https://sepolia.basescan.org/tx/0x31470ed4a3c57c2d65cd2c765b91a301f54583d9b92e5bd3d59c066024f818af) |
| 4 | Compass (A\*) pays $0.001 USDC for x402 data | [`0x15df94c6…`](https://sepolia.basescan.org/tx/0x15df94c6fdc94988a32e3837d928b58ad32e9bb0888c0eaeea5761af0497ccd5) |
| 5 | Dice (Monte Carlo) pays $0.001 USDC for x402 data | [`0x9f369496…`](https://sepolia.basescan.org/tx/0x9f36949637c4005af7f7c15b5a9fda7baff4b305fcc0a10cdac1d4c1e29ea12f) |
| 6 | Dash (Greedy) pays $0.001 USDC for x402 data | [`0x281a2ce0…`](https://sepolia.basescan.org/tx/0x281a2ce08d592266c378a4d69274671a4d9c8f60cbe0ed5b0b5450524ec2e267) |
| 7 | Winner payout ($0.50 USDC → winning agent) | [`0x9eac3473…`](https://sepolia.basescan.org/tx/0x9eac34738f7a8d594cc1fe6adab70c6178a54112b83339ad34ed1dca212604a0) |
| 8 | **Verdict hash published to OriginVerdictRegistry** | [`0xa2334928…`](https://sepolia.basescan.org/tx/0xa2334928531fbca8c3755879aae6ff2175d663f4dd06a641a7d430e27b9d7023) |

> **Verdict hash on-chain: `3e65379a4d71b58f48f4bfdb61ed30b199f4d563416e53f78b5c470197ba975e`**
> — derived from a SHA-256 over the canonical (sorted-keys) verdict JSON. Anyone can re-derive the hash from the verdict bundle and prove it matches the on-chain record. Tamper-evident judging.

---

## Architecture

```
       ┌──────────────────────┐                ┌─────────────────────┐
       │   USER (browser)     │                │   COINBASE CDP      │
       │   Liquid-glass UI    │                │   Wallet + USDC     │
       │   driven by SSE      │                │   on Base Sepolia   │
       └──────────┬───────────┘                └──────────┬──────────┘
                  │ HTTP + SSE                            │  on-chain txs
                  ↓                                       ↓
       ┌──────────────────────────────────────────────────────────────┐
       │           ORIGIN ORCHESTRATOR  (ECS Fargate / local)          │
       │   ┌────────────────────────────────────────────────────────┐ │
       │   │  OPTIMUS  (Bedrock Claude Sonnet 4.5 + deterministic)   │ │
       │   │  • Classifier  • Auditor  • Scorer                      │ │
       │   │  • Judger      • Payer    • Verdict-hash Publisher      │ │
       │   └────────────────────────────────────────────────────────┘ │
       │                                                              │
       │   ┌─────┐ ┌─────┐ ┌────────┐ ┌─────┐ ┌─────┐                 │
       │   │BFS  │ │DFS  │ │A*      │ │MC   │ │GRD  │  AGENTS         │
       │   │Scout│ │Drill│ │Compass │ │Dice │ │Dash │                 │
       │   └──┬──┘ └──┬──┘ └────┬───┘ └──┬──┘ └──┬──┘                 │
       │      └───────┴─────────┴────────┴───────┘                    │
       │                       │ each pays x402                       │
       └───────────────────────┼──────────────────────────────────────┘
                               ↓
              ┌────────────────────────────────┐
              │  x402-SELLER (Lambda@Edge)     │
              │  /data/defi-protocols          │
              │  HTTP 402 → verifies tx on RPC │
              │  → returns DeFi data           │
              └────────────────────────────────┘
                               │
                               ↓
              ┌────────────────────────────────┐
              │  BASE SEPOLIA                  │
              │  • USDC (real testnet)         │
              │  • OriginVerdictRegistry.sol   │
              │  • All txs visible on basescan │
              └────────────────────────────────┘
```

---

## The five algorithm-bound agents

Each agent is **constrained to a single search algorithm** with deterministic audit rules. If an agent violates its constraint, Optimus catches it and disqualifies the submission. This makes the competition reproducible, not vibes-based.

| Agent | Algorithm | Constraint | Audit rule |
|---|---|---|---|
| **Scout** | BFS | Must visit ≥3 distinct depth-1 nodes before any depth-2 node | `depthByNode` log inspected; FIFO queue order verified |
| **Drill** | DFS | Must commit to a single path until depth ≥3 before backtracking | `committedPath` length, `backtrackEvents` ordering verified |
| **Compass** | A\* | Heuristic must be declared at t=0; SHA-256 hashed; immutable across run | `heuristicVersion` hash compared at every emit; drift = DQ |
| **Dice** | Monte Carlo | Min 10 samples, fixed seed logged; reports variance + confidence | `sampleCount`, `seed` deterministic verification |
| **Dash** | Greedy | Must NEVER revisit a node | `visited` set deduped; collisions = DQ |

The 7-dimension scoring rubric ([`apps/api/src/optimus/scorer.ts`](apps/api/src/optimus/scorer.ts)): constraint compliance (20pt), answer quality (20pt), methodology fit (18pt), evidence quality (15pt), coverage depth (12pt), reasoning clarity (10pt), speed/cost efficiency (5pt). 100-point total.

---

## Live deployments

| Component | Status | Reference |
|---|---|---|
| `OriginVerdictRegistry.sol` | ✅ Live on Base Sepolia | [`0xad6870E90…`](https://sepolia.basescan.org/address/0xad6870E90311BB5CA2f03CC16DAa5b447618F56E) |
| Agent CDP wallet | ✅ Live + funded | [`0xfdbb534eB…`](https://sepolia.basescan.org/address/0xfdbb534eB0Ed764Cb743893177CFEf91c9CAF540) |
| Frontend UI showcase | ✅ Live | [GitHub Pages](https://thebarmaeffect.github.io/origin-agent-bounty-hunter/) |
| Backend (ECS Fargate) | 🟢 CDK stack ready | `cdk deploy AppStack` |
| x402-seller (Lambda@Edge) | 🟢 CDK stack ready | `cdk deploy SellerDataStack` |

---

## Run it yourself

### Quick start (local, no creds required)

```bash
git clone https://github.com/TheBarmaEffect/origin-agent-bounty-hunter
cd origin-agent-bounty-hunter
npm install
cp .env.example .env
npm run dev
# → http://localhost:5173
```

This runs in fixture mode — full UI, simulated payments. No external dependencies.

### Live mode (real Base Sepolia transactions)

Add to `.env`:
```bash
# Coinbase CDP (https://portal.cdp.coinbase.com)
CDP_API_KEY_ID=<your-uuid>
CDP_API_KEY_SECRET=<your-base64-secret>
CDP_WALLET_SECRET=<from CDP portal → Server Wallets → Generate>

# Provision wallet + claim faucet ETH/USDC (one-time)
# This writes AGENT_WALLET_ADDRESS=... back into .env
npx tsx scripts/setupWallet.ts

# Generate a verdict-publisher EOA, fund from CDP wallet (one-time)
# This writes VERDICT_PRIVATE_KEY=... back into .env
npx tsx scripts/setupVerdictDeployer.ts

# Use the existing verdict contract OR deploy your own:
VERDICT_CONTRACT_ADDRESS=0xad6870E90311BB5CA2f03CC16DAa5b447618F56E
# (To deploy a fresh one: cd packages/contracts && npm install && npm run deploy:sepolia)

# Enable real on-chain payments
REAL_PAYMENTS=true

# (Optional) Enable Bedrock for live Claude Sonnet verdict text
BEDROCK_REGION=us-east-1
AWS_ACCESS_KEY_ID=<your-key>
AWS_SECRET_ACCESS_KEY=<your-secret>
```

```bash
npm run dev
```

### Deploy to your own AWS

```bash
cd infra/cdk
npm install
cdk bootstrap
cdk deploy --all
```

Provisions: ECS Fargate (API + SSE), S3 + CloudFront (frontend), Lambda@Edge x402 verifier (us-east-1 required), 5 DynamoDB tables, Secrets Manager. Bedrock model access enabled separately via [AWS console](https://console.aws.amazon.com/bedrock/home#/model-access).

---

## Repository layout

```
.
├── apps/
│   ├── api/                  Express + tsx backend (Optimus + agents + SSE)
│   │   └── src/
│   │       ├── agents/       Scout, Drill, Compass, Dice, Dash
│   │       ├── optimus/      Classifier, auditor, scorer, judger, payer, explainer
│   │       ├── payments/     CDP payer, x402 adapters
│   │       ├── proof/        SHA-256 verdict hasher + viem chain publisher
│   │       └── services/     Race engine (full SSE event sequence)
│   ├── web/                  Vite + React 18 + Tailwind + Framer Motion
│   └── x402-seller/          Lambda@Edge x402 payment-gated DeFi data API
├── packages/
│   ├── shared/               TypeScript types, Zod schemas, SSE event contracts
│   ├── payment-client/       Reusable OriginPaymentClient (any agent imports)
│   └── contracts/            Solidity OriginVerdictRegistry + Hardhat
├── infra/
│   └── cdk/                  AWS CDK v2 stacks
└── scripts/                  Wallet setup, deployer setup, smoke tests
```

---

## Tests

```bash
cd packages/payment-client && npm test    # 7 passing
cd apps/x402-seller && npm test           # 5 passing
cd packages/contracts && npm test         # 5 passing

# Real on-chain smoke tests
npx tsx scripts/realUsdcPayment.ts        # one real $0.001 USDC tx
npx tsx scripts/realX402Roundtrip.ts      # full 402 → sign → verify → 200 round-trip
```

---

## License

MIT — see [LICENSE](LICENSE)

---

<div align="center">

**Origin** — built for the Consensus Miami EasyA Hackathon · Agentic Track
Powered by **Coinbase x402 + AgentKit** · **Base Sepolia** · **Amazon Bedrock**

</div>
