export interface X402PaymentSpec {
  x402Version: 1;
  accepts: Array<{
    scheme: "exact";
    network: string;
    maxAmountRequired: string;
    resource: string;
    description: string;
    mimeType: string;
    payTo: string;
    maxTimeoutSeconds: number;
    asset: string;
    extra: { name: string; version: string };
  }>;
}

export function buildPaymentSpec(resource: string): X402PaymentSpec {
  return {
    x402Version: 1,
    accepts: [{
      scheme: "exact",
      network: process.env.X402_NETWORK || "base-sepolia",
      maxAmountRequired: process.env.PAYMENT_AMOUNT_USDC_MICRO || "1000",
      resource,
      description: "DeFi protocol research data — Origin Agent Bounty Hunter",
      mimeType: "application/json",
      payTo: process.env.WALLET_ADDRESS || "0x0000000000000000000000000000000000000001",
      maxTimeoutSeconds: 60,
      asset: process.env.USDC_CONTRACT || "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      extra: { name: "USDC", version: "2" }
    }]
  };
}

export function isValidPaymentSpecShape(spec: any): boolean {
  return (
    spec?.x402Version === 1 &&
    Array.isArray(spec?.accepts) &&
    spec.accepts.length > 0 &&
    typeof spec.accepts[0].payTo === "string" &&
    typeof spec.accepts[0].maxAmountRequired === "string" &&
    typeof spec.accepts[0].asset === "string"
  );
}
