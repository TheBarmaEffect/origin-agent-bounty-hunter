# Origin — Real Mode Setup Guide

This guide walks through enabling all live integrations: x402 payments, Coinbase CDP / AgentKit, Base Sepolia smart contract, and AWS infrastructure.

---

## Prerequisites

- Node.js 20+
- Docker (for building the API container image)
- AWS CLI configured (`aws configure`)
- A Base Sepolia wallet funded with test ETH

---

## Part 1 — x402 Protocol

### Option A: Use the public facilitator

```bash
X402_FACILITATOR_URL=https://facilitator.x402.org
```

No additional setup required.

### Option B: Self-host the facilitator

Clone and run [github.com/coinbase/x402](https://github.com/coinbase/x402) locally or in a container, then point `X402_FACILITATOR_URL` at your instance.

### Verify x402 is working

```bash
curl -I http://localhost:3001/data/defi-protocols
# Expect: HTTP/1.1 402 Payment Required
# Header: X-Origin-Version: 1.0.0
```

---

## Part 2 — Coinbase CDP and AgentKit

### 2.1 Create a CDP project

1. Navigate to [portal.cdp.coinbase.com](https://portal.cdp.coinbase.com)
2. Create a new project
3. Download the API key JSON file

### 2.2 Configure the environment

The downloaded JSON contains both the key name and the private key PEM. Extract them:

```bash
# From the downloaded JSON:
CDP_API_KEY_ID=organizations/<org-id>/apiKeys/<key-name>
CDP_API_KEY_SECRET=-----BEGIN EC PRIVATE KEY-----\n<base64>\n-----END EC PRIVATE KEY-----\n
```

### 2.3 Create agent wallets

On first startup with `DEMO_MODE=false`, the API will create five CDP wallets (one per agent) and print their addresses to stdout. Save the `CDP_WALLET_SECRET` (the exported wallet seed JSON) into your `.env`:

```bash
CDP_WALLET_SECRET={"encrypted_seed":"...","iv":"..."}
```

### 2.4 Fund wallets on Base Sepolia

Each agent wallet needs:
- A small amount of Base Sepolia ETH for gas (~0.001 ETH per wallet, available from the [Coinbase faucet](https://faucet.coinbase.com/))
- USDC on Base Sepolia for the data purchase payment (Flow B)

The bounty prize pool is funded by the poster, so agents only need USDC for data purchases.

---

## Part 3 — Base Sepolia Smart Contract

### 3.1 Fund the publisher wallet

The `VERDICT_PRIVATE_KEY` wallet publishes verdict proofs on-chain. It needs Base Sepolia ETH for gas.

```bash
# Get Base Sepolia ETH from:
# https://faucet.quicknode.com/base/sepolia
# https://www.alchemy.com/faucets/base-sepolia
```

### 3.2 Deploy the contract

```bash
cd packages/contracts
npm install
npm run compile

# Set env vars
export BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
export VERDICT_PRIVATE_KEY=0x<your-private-key>

npm run deploy:sepolia
```

Sample output:

```
Deploying OriginVerdictRegistry to Base Sepolia...
Deploying with account: 0xYourAddress
Account balance: 0.05 ETH
OriginVerdictRegistry deployed to: 0xABC123...
Add to .env: VERDICT_CONTRACT_ADDRESS=0xABC123...
```

### 3.3 Verify on Basescan (optional)

```bash
export BASESCAN_API_KEY=<your-basescan-api-key>
npx hardhat verify --network baseSepolia 0xABC123...
```

Get a free Basescan API key at [basescan.org/myapikey](https://basescan.org/myapikey).

### 3.4 Update .env

```bash
VERDICT_CONTRACT_ADDRESS=0xABC123...
```

---

## Part 4 — AWS Infrastructure

### 4.1 Bootstrap CDK

Run once per AWS account/region:

```bash
cd infra/cdk
npm install
npm run build
cdk bootstrap aws://<account-id>/us-east-1
```

### 4.2 Deploy stacks

```bash
# Deploy all stacks
npm run deploy

# Or deploy individually in order:
cdk deploy OriginSecretsStack
cdk deploy OriginDataStack
cdk deploy OriginSellerDataStack   # Note: deploys to us-east-1 for Lambda@Edge
cdk deploy OriginAppStack
cdk deploy OriginWebStack
```

### 4.3 Populate secrets

After deploying `OriginSecretsStack`, populate the placeholder values:

```bash
aws secretsmanager put-secret-value \
  --secret-id origin/CDP_API_KEY_ID \
  --secret-string "your-cdp-key-id"

aws secretsmanager put-secret-value \
  --secret-id origin/CDP_API_KEY_SECRET \
  --secret-string "-----BEGIN EC PRIVATE KEY-----\n..."

aws secretsmanager put-secret-value \
  --secret-id origin/CDP_WALLET_SECRET \
  --secret-string '{"encrypted_seed":"..."}'

aws secretsmanager put-secret-value \
  --secret-id origin/BASE_SEPOLIA_RPC_URL \
  --secret-string "https://sepolia.base.org"

aws secretsmanager put-secret-value \
  --secret-id origin/VERDICT_PRIVATE_KEY \
  --secret-string "0x<your-private-key>"

aws secretsmanager put-secret-value \
  --secret-id origin/X402_FACILITATOR_URL \
  --secret-string "https://facilitator.x402.org"
```

### 4.4 Build and push the API container

```bash
# Get ECR URI from CDK output or:
ECR_URI=$(aws cloudformation describe-stacks \
  --stack-name OriginAppStack \
  --query "Stacks[0].Outputs[?OutputKey=='EcrRepositoryUri'].OutputValue" \
  --output text)

# Authenticate
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin $ECR_URI

# Build and push
docker build -t origin-api ./apps/api
docker tag origin-api:latest $ECR_URI:latest
docker push $ECR_URI:latest

# Force a new ECS deployment to pick up the image
aws ecs update-service \
  --cluster origin-cluster \
  --service OriginApiService \
  --force-new-deployment
```

### 4.5 Deploy the frontend

The `OriginWebStack` BucketDeployment syncs `apps/web/dist` on every `cdk deploy`. Build the frontend first:

```bash
cd apps/web
npm run build   # outputs to dist/
cd ../..
cd infra/cdk
cdk deploy OriginWebStack
```

The CloudFront URL is in the `CloudFrontUrl` stack output.

---

## Part 5 — Smoke Test (Real Mode)

```bash
# 1. Check the API is healthy
curl https://<alb-dns-name>/health
# Expected: { "status": "ok", "mode": "real" }

# 2. Post a bounty (will attempt a real x402 payment)
curl -X POST https://<alb-dns-name>/bounty \
  -H "Content-Type: application/json" \
  -d '{ "problemType": "heuristic-structured", "prizeUsdc": 2 }'

# 3. Hit the gated data endpoint without payment
curl -I https://<cloudfront-seller-url>/defi-protocols/top-100.json
# Expected: HTTP/1.1 402 Payment Required
```

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| ECS tasks failing to start | ECR image not pushed yet | Push container image (Step 4.4) |
| `Not authorized` from contract | Publisher wallet not added | Call `addPublisher(addr)` from owner wallet |
| x402 payment rejected | Facilitator URL wrong or wallet underfunded | Check `X402_FACILITATOR_URL` and wallet balance |
| Lambda@Edge not intercepting | CloudFront cache serving old response | Invalidate `/*` in the distribution |
| DynamoDB `ResourceNotFoundException` | Tables not deployed or wrong prefix | Run `cdk deploy OriginDataStack` |
