# x402-seller — Payment-Gated DeFi Data Endpoint

Part of the **Origin Agent Bounty Hunter** project. This Lambda serves DeFi protocol research data behind an x402 micropayment wall using USDC on Base Sepolia.

## What it does

- Returns HTTP 402 with a payment spec (x402 v1) when no `x-payment` header is present
- Verifies payment against the CDP Facilitator (`https://x402.org/facilitator`) when a header is provided
- Returns DeFi protocol data (from S3 or built-in fixture) when payment is verified
- Supports `MOCK_X402=true` to bypass payment for local development

## Local Development

```bash
npm install

# Start with mock mode (no real payment needed)
MOCK_X402=true npm run dev

# Verify it works
curl http://localhost:3002/data/defi-protocols
curl http://localhost:3002/health
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MOCK_X402` | `false` | Set to `true` to skip payment verification |
| `WALLET_ADDRESS` | `0x000...0001` | Address to receive USDC payments |
| `USDC_CONTRACT` | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` | USDC contract on Base Sepolia |
| `X402_NETWORK` | `base-sepolia` | Network identifier for x402 spec |
| `PAYMENT_AMOUNT_USDC_MICRO` | `1000` | Payment amount in USDC micro-units (1000 = $0.001) |
| `FACILITATOR_URL` | `https://x402.org/facilitator` | CDP Facilitator endpoint |
| `S3_BUCKET_NAME` | _(unset)_ | S3 bucket for DeFi data; uses fixture if unset |
| `AWS_REGION` | `us-east-1` | AWS region for S3 client |
| `PORT` | `3002` | Local dev server port |

## Testing

```bash
npm test          # Run all 5 vitest tests
npm run typecheck # TypeScript type check
npm run build     # Bundle for Lambda deployment
```

## curl Examples

```bash
# No payment → 402 with payment spec
curl -v http://localhost:3002/data/defi-protocols

# With mock mode (no real payment needed)
MOCK_X402=true npm run dev
curl http://localhost:3002/data/defi-protocols

# After AWS deploy (real x402) — no payment header → 402
curl -v https://YOUR_CLOUDFRONT_URL/data/defi-protocols

# After AWS deploy — with signed payment header → 200 + data
curl -H "x-payment: YOUR_SIGNED_PAYMENT" https://YOUR_CLOUDFRONT_URL/data/defi-protocols
```

## AWS Deployment (CDK)

The `infra/cdk-stack.ts` provisions:
- S3 bucket with DeFi fixture data pre-loaded
- Lambda@Edge function (must deploy to `us-east-1`)
- CloudFront distribution with caching disabled (every request must be verified)

```bash
# Build the Lambda bundle first
npm run build

# Deploy via CDK (from repo root or infra dir)
cdk deploy --app "ts-node infra/cdk-stack.ts"
```

**Important:** Lambda@Edge viewer-request functions have limited env var support. Production config should use SSM Parameter Store for secrets (wallet address, facilitator URL, etc.).

## x402 Payment Flow

1. Client requests `/data/defi-protocols` — gets 402 + payment spec JSON
2. Client signs a USDC transfer on Base Sepolia and includes it as `x-payment` header
3. Lambda forwards header to CDP Facilitator for verification
4. On success, Lambda returns DeFi data with `X-Payment-Tx-Hash` header
