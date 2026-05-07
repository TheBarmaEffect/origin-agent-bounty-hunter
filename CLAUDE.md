# Origin Agent Bounty Hunter — CLAUDE.md

## Project Goal
A live competitive agent bounty arena where algorithm-bound agents race to answer a user's bounty, Optimus audits and judges, the winner is paid via x402, and a verdict proof is published to Base Sepolia.

## Workspace Structure
- `apps/api` — Express/TypeScript backend, SSE race engine, Optimus, agents
- `apps/web` — Vite React/TypeScript frontend with Framer Motion live arena
- `packages/shared` — Shared Zod schemas, types, SSE event contracts
- `packages/contracts` — Solidity OriginVerdictRegistry + Hardhat
- `infra/cdk` — AWS CDK TypeScript stacks

## Build Commands
```bash
npm install          # install all workspaces
npm run dev          # start api + web concurrently
npm run build        # build all packages
npm run typecheck    # tsc --noEmit across all workspaces
npm run test         # vitest across all packages
npm run lint         # eslint across all packages
```

## Individual Dev
```bash
cd apps/api && npm run dev    # port 3001
cd apps/web && npm run dev    # port 5173
```

## Code Style Rules
- TypeScript strict mode everywhere — no `any` without explicit comment
- Zod schemas at all API boundaries
- No secrets in code — only `process.env.*` with `.env.example` reference
- Structured logs: `{ level, bountyId, agentId, message, ...meta }`
- No `eval`, no `exec` from user input
- Prefer `const` and functional patterns
- Files export named exports, not default where ambiguous

## No Secrets Rule
- All credentials via environment variables only
- `.env` is gitignored
- `.env.example` documents every variable
- Local demo mode must work with no credentials

## Demo Mode Rules
- `DEMO_MODE=true` (default) — all agents run deterministically with fixture data
- SSE race emits realistic timing delays (not instant)
- x402 uses LocalPaymentAdapter (simulates challenge/sign/settle)
- Verdict hash generated locally without chain write
- DynamoDB/S3 uses local JSON file storage adapters

## Real Integration Mode
- `DEMO_MODE=false` requires: CDP keys, Base Sepolia RPC, private key for verdict publishing
- x402 uses real facilitator from `X402_FACILITATOR_URL`
- Base Sepolia contract write via `VERDICT_PRIVATE_KEY`
- Bedrock explanation via AWS credentials + `BEDROCK_REGION`
- DynamoDB via `AWS_REGION` + IAM role or `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`

## Acceptance Criteria
1. `cp .env.example .env && npm install && npm run dev` works
2. UI opens and bounty can be started
3. Live race with real timing delays
4. Each agent visibly different algorithm
5. Optimus classification emitted before race ends
6. Deterministic pass/fail audit checks per agent
7. At least one demo path shows disqualification
8. Winner selected with score breakdown
9. Payment flow visible in UI
10. Verdict hash generated
11. Replay works
12. Strategy memory updates after bounty
13. Typecheck and tests pass
