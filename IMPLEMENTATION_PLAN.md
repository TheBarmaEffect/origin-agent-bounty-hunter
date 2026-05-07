# Origin Agent Bounty Hunter — Implementation Plan

## Architecture Overview

```
User Browser
    │
    ├── POST /api/bounties (x402-gated)
    │       │
    │       └── Optimus Classifier → classifies problem type
    │               │
    │               └── Dispatcher → fans out to 5 agents simultaneously
    │                       │
    │                       ├── Scout (BFS)
    │                       ├── Drill (DFS)
    │                       ├── Compass (A*)
    │                       ├── Dice (Monte Carlo)
    │                       └── Dash (Greedy) ← submits first
    │
    ├── GET /api/bounties/:id/events (SSE stream)
    │       └── emits: bounty.created → optimus.classified → agent.*
    │                → optimus.verdict → payment.* → proof.*
    │
    └── GET /paid-data/defi/protocols (x402-gated data provider)

Verdict Bundle → SHA-256 hash → Base Sepolia (OriginVerdictRegistry)
Strategy Memory → DynamoDB (local: JSON file)
```

## Modules

### packages/shared
- `types.ts` — all TypeScript types
- `schemas.ts` — Zod schemas for Bounty, Submission, Verdict, etc.
- `events.ts` — SSE event type unions

### apps/api
- `server.ts` — Express setup, CORS, middleware
- `routes/bounties.ts` — POST/GET bounty endpoints
- `routes/paidData.ts` — x402-gated data endpoint
- `routes/strategyStats.ts` — GET strategy memory
- `sse/raceStream.ts` — SSE emitter + event queue
- `agents/types.ts` — AgentRuntime interface
- `agents/scout.ts` — BFS agent
- `agents/drill.ts` — DFS agent
- `agents/compass.ts` — A* agent
- `agents/dice.ts` — Monte Carlo agent
- `agents/dash.ts` — Greedy agent
- `optimus/classifier.ts` — Problem type classifier
- `optimus/dispatcher.ts` — Fan-out orchestrator
- `optimus/auditor.ts` — Deterministic constraint auditor
- `optimus/scorer.ts` — Multi-dimension scorer
- `optimus/judger.ts` — Winner selection
- `optimus/explainer.ts` — Bedrock or local explanation
- `optimus/payer.ts` — x402 payment to winner
- `optimus/proofPublisher.ts` — Base Sepolia or local hash
- `optimus/strategyMemory.ts` — Wins/losses/stats tracker
- `payments/x402Adapter.ts` — Adapter interface
- `payments/localAdapter.ts` — Demo mode adapter
- `payments/realAdapter.ts` — Real x402 adapter stub
- `storage/index.ts` — Storage interface
- `storage/localFileStorage.ts` — JSON file storage
- `storage/dynamoAdapter.ts` — DynamoDB adapter stub
- `data/defiData.ts` — DefiLlama fetch + fixture fallback
- `replay/replayEngine.ts` — Stored event replay
- `proof/verdictHasher.ts` — Canonical JSON hash
- `proof/chainPublisher.ts` — Base Sepolia contract call

### apps/web
- `src/pages/Arena.tsx` — main live race view
- `src/pages/Launcher.tsx` — bounty creation form
- `src/pages/Verdict.tsx` — verdict receipt + replay
- `src/components/AgentCard.tsx` — live status card
- `src/components/OptimusPanel.tsx` — classifier + audit panel
- `src/components/LeaderboardBar.tsx` — score bars
- `src/components/PaymentFlow.tsx` — x402 payment animation
- `src/components/ArchitectureView.tsx` — system diagram
- `src/hooks/useBountySSE.ts` — SSE event consumer
- `src/lib/api.ts` — typed API client

## SSE Event Contract

All events: `{ id, bountyId, type, timestamp, payload }`

Sequence:
1. `bounty.created`
2. `bounty.payment_required` (if x402 enabled)
3. `bounty.payment_verified`
4. `optimus.classifying`
5. `optimus.classified` → { problemType, expectedWinnerAgentId, confidence }
6. `bounty.dispatched`
7. `agent.queued` × 5
8. `agent.running` × 5 (staggered)
9. `agent.progress` × N (algorithm-specific updates)
10. `agent.submitted` × 5 (different timings)
11. `agent.audit_started` × 5
12. `agent.audit_passed` / `agent.audit_failed` × 5
13. `agent.scored` × 5
14. `optimus.judging`
15. `optimus.verdict` → winner, scores, rationale
16. `payment.started`
17. `payment.challenge`
18. `payment.settled`
19. `proof.hash_created`
20. `proof.onchain_published` (if chain configured)
21. `strategy_memory.updated`
22. `bounty.completed`

## Agent Timing (demo mode)
- Dash submits at: ~8s
- Scout submits at: ~22s
- Compass submits at: ~28s
- Dice submits at: ~32s
- Drill submits at: ~40s

## Scoring Formula
```
total = constraintCompliance(20) + answerQuality(20) + methodologyFit(18)
      + evidenceQuality(15) + coverageDepth(12) + reasoningClarity(10)
      + speedCostEfficiency(5)

if constraintCompliance < 50%: DISQUALIFIED
```

## x402 Flow

### Flow A: User pays to start bounty
```
POST /api/bounties (no payment) → 402 { payment_required: {...} }
POST /api/bounties + X-PAYMENT header → 200 { bountyId }
```

### Flow B: Optimus pays winner
```
payer.payWinner(agentWalletAddress, amountUsdc)
  → x402Adapter.pay(sellerEndpoint, amount)
  → emits payment.* SSE events
```

### Flow C: Agent pays for data
```
agent fetches /paid-data/defi/protocols
  → server returns 402 challenge
  → agent uses x402Adapter to pay
  → server verifies → returns data
```

## Optimus Classification Rules
- "top N across many" → heuristic-structured → Compass expected winner
- "investigate root cause" → depth-investigation → Drill
- "creative/unknown search" → probabilistic-search → Dice
- "strict time limit / first acceptable" → speed-critical → Dash
- "broad discovery without ranking" → breadth-discovery → Scout
- "multiple criteria" → hybrid → Compass or Dice

## AWS Deployment Map
- WebStack: S3 + CloudFront → frontend
- SellerDataStack: S3 + CloudFront + Lambda@Edge x402 verifier
- AppStack: ECS or App Runner (SSE-compatible)
- DataStack: DynamoDB 5 tables
- SecretsStack: Secrets Manager entries

## Base Sepolia Proof Flow
1. Compute verdictHash = SHA-256(canonicalize(verdictBundle))
2. If VERDICT_PRIVATE_KEY set: call OriginVerdictRegistry.publishVerdict()
3. Else: store hash in local /data/verdicts/{bountyId}.json

## Demo Script
1. Open http://localhost:5173
2. Enter bounty: "Find top 3 risk-adjusted DeFi protocols..."
3. Budget: 2 USDC, Time limit: 90s
4. Click Start Bounty → x402 payment animation
5. Watch agents race live
6. Dash submits first (~8s)
7. Optimus classification appears
8. Other agents submit over 40s
9. One agent gets disqualified (Drill fails breadth check if misconfigured)
10. Optimus scores all, selects Compass as winner
11. Payment animation: USDC to Compass
12. Verdict hash appears + Base Sepolia status
13. Strategy memory leaderboard updates

## Known Limitations
- Agents do not call real external APIs in demo mode (use fixtures)
- Bedrock explanation falls back to deterministic local explanation without AWS creds
- Base Sepolia write requires VERDICT_PRIVATE_KEY + funded wallet
- x402 real mode requires CDP API keys
- DynamoDB requires AWS credentials
