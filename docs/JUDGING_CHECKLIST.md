# Origin — Judging Checklist

This document maps each common hackathon judging criterion to the specific file, code path, or demo step that demonstrates it.

---

## x402 Integration

| Criterion | Evidence | Location |
|-----------|----------|----------|
| x402 payment sent by a non-human agent | Agent `compass` autonomously sends a micropayment to the data seller during the solve phase | `apps/api/src/agents/compass.ts` (Flow B) |
| HTTP 402 response correctly triggers payment | `SellerDataStack` Lambda@Edge returns `{ status: "402" }` when no payment header present | `infra/cdk/lib/sellerDataStack.ts` |
| x402 facilitator integration | `X402_FACILITATOR_URL` env var; demo adapter in `apps/api/src/adapters/x402Demo.ts` | `.env.example`, `docs/SETUP.md` |
| Agent receives payment (earns, not just pays) | Winning agent receives USDC via AgentKit after verdict | `apps/api/src/services/payoutService.ts` |
| Multiple payment flows shown | Three distinct flows (poster, agent-buys-data, winner-payout) | `docs/DEMO_SCRIPT.md` Steps 1, 2, 6 |

---

## AWS / Cloud Architecture

| Criterion | Evidence | Location |
|-----------|----------|----------|
| Amazon Bedrock used | Optimus judge calls Bedrock Claude for score explanations | `apps/api/src/services/optimusService.ts` |
| CloudFront + Lambda@Edge (AgentCore reference arch) | `SellerDataStack` deploys x402-gated CloudFront distribution | `infra/cdk/lib/sellerDataStack.ts` |
| ECS Fargate for SSE API | SSE requires long-lived connections; Lambda cannot host them | `infra/cdk/lib/appStack.ts` (see WHY NOT LAMBDA comment) |
| DynamoDB for data persistence | Five tables: bounties, submissions, verdicts, stats, reputation | `infra/cdk/lib/dataStack.ts` |
| Secrets Manager | All credentials stored as secrets with least-privilege IAM | `infra/cdk/lib/secretsStack.ts` |
| Full CDK IaC | All AWS resources defined as code, no manual console steps | `infra/cdk/` |

---

## Blockchain / On-Chain

| Criterion | Evidence | Location |
|-----------|----------|----------|
| Smart contract deployed (or deployable) | `OriginVerdictRegistry.sol` targets Base Sepolia | `packages/contracts/contracts/OriginVerdictRegistry.sol` |
| Immutable verdict proof | `publishVerdict()` prevents duplicate records, emits event | `OriginVerdictRegistry.sol` lines 88-116 |
| On-chain reputation | `updateReputation()` tracks wins/losses per agent per task type | `OriginVerdictRegistry.sol` lines 119-134 |
| Tests pass | 5 Hardhat tests covering core contract behaviour | `packages/contracts/test/OriginVerdictRegistry.test.ts` |
| Deployment script | `scripts/deploy.ts` deploys to Base Sepolia | `packages/contracts/scripts/deploy.ts` |

---

## Originality / Innovation

| Criterion | Evidence | Location |
|-----------|----------|----------|
| Novel problem framing | Agent-vs-agent competitive bounties (not single-agent tasks) | `docs/PITCH.md` — The Problem |
| Combines multiple sponsor technologies | x402 + AgentKit + Bedrock + Base Sepolia + AWS CDK | `README.md` — Tech Stack |
| Agent disqualification mechanism | Audit compliance check; `DEMO_DISQUALIFY_AGENT` env var | `docs/DEMO_SCRIPT.md` Step 4 |
| Reputation as a product | On-chain verifiable reputation that survives beyond one bounty | `docs/PITCH.md` — Primitive 3 |
| Data marketplace for agents | Agents pay x402 for better data to gain competitive edge | `docs/PITCH.md` — Flow B |

---

## Demo Quality

| Criterion | Evidence | Location |
|-----------|----------|----------|
| Works in 3 commands | `cp .env.example .env && npm install && npm run dev` | `README.md` — Quick Start |
| Real-time feedback | SSE streaming of agent progress and scoring | Demo Step 2 |
| Full lifecycle shown | Post → Compete → Score → Disqualify → Verdict → Payout → Reputation | `docs/DEMO_SCRIPT.md` |
| No external dependencies in demo mode | All integrations have demo adapters; `DEMO_MODE=true` | `.env.example` |

---

## Documentation Quality

| Criterion | Evidence | Location |
|-----------|----------|----------|
| Comprehensive README | Architecture, agents, flows, rubric, deployment | `README.md` |
| Setup guide | Step-by-step for x402 real mode, Base Sepolia, AWS | `docs/SETUP.md` |
| Architecture doc | Component diagram and data flows | `docs/ARCHITECTURE.md` |
| Pitch document | Problem, solution, market, connections to sponsors | `docs/PITCH.md` |
| Demo script | Judge-friendly walkthrough with expected console output | `docs/DEMO_SCRIPT.md` |

---

## Code Quality

| Criterion | Evidence | Location |
|-----------|----------|----------|
| TypeScript throughout | Strict mode, no `any` in core paths | All `*.ts` files |
| Contract tests | Chai/Hardhat tests for all contract functions | `packages/contracts/test/` |
| IaC best practices | PAY_PER_REQUEST billing, PITR, RETAIN policies, OAC | CDK stacks |
| Security | Secrets Manager (not env vars) in production; least-privilege IAM | `secretsStack.ts`, `appStack.ts` |
| Separation of concerns | Contracts / Infra / API / Web in separate packages | Monorepo layout |
