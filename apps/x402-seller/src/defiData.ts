export const DEMO_DEFI_DATA = [
  {"protocol": "Aerodrome", "tvl": 890000000, "volume24h": 45000000, "apy": 12.4, "chain": "Base"},
  {"protocol": "Uniswap V3", "tvl": 3200000000, "volume24h": 890000000, "apy": 8.1, "chain": "Multi"},
  {"protocol": "Curve", "tvl": 1800000000, "volume24h": 234000000, "apy": 6.7, "chain": "Multi"},
  {"protocol": "Aave V3", "tvl": 6700000000, "volume24h": 123000000, "apy": 4.2, "chain": "Multi"},
  {"protocol": "Compound", "tvl": 890000000, "volume24h": 45000000, "apy": 3.8, "chain": "Multi"}
];

export async function fetchDefiData(): Promise<typeof DEMO_DEFI_DATA> {
  if (!process.env.S3_BUCKET_NAME) {
    // No S3 configured — use built-in fixture
    return DEMO_DEFI_DATA;
  }
  try {
    const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
    const client = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
    const res = await client.send(new GetObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: "defi-protocols.json"
    }));
    const body = await res.Body?.transformToString();
    return body ? JSON.parse(body) : DEMO_DEFI_DATA;
  } catch (err) {
    console.warn("[x402-seller] S3 fetch failed, using fixture:", err);
    return DEMO_DEFI_DATA;
  }
}
