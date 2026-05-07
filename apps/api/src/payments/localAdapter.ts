import { v4 as uuidv4 } from "uuid";
import type { X402Adapter, PaymentChallenge, PaymentResult } from "./x402Adapter";

const DEMO_PAY_TO = process.env.PAYMENT_ADDRESS || "0x0000000000000000000000000000000000000001";

export class LocalX402Adapter implements X402Adapter {
  async createChallenge(amount: string, purpose: string): Promise<PaymentChallenge> {
    const challenge: PaymentChallenge = {
      paymentId: uuidv4(),
      amount,
      asset: "USDC",
      network: "eip155:84532",
      payTo: DEMO_PAY_TO,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    };
    console.log(JSON.stringify({
      level: "info",
      timestamp: new Date().toISOString(),
      message: "[x402/local] challenge created",
      paymentId: challenge.paymentId,
      amount,
      purpose,
    }));
    return challenge;
  }

  async verifyPayment(header: string, challenge: PaymentChallenge): Promise<boolean> {
    // In demo mode: accept if header starts with "demo-signed-" or is any non-empty string
    const valid = typeof header === "string" && header.length > 0;
    console.log(JSON.stringify({
      level: "info",
      timestamp: new Date().toISOString(),
      message: "[x402/local] payment verified",
      paymentId: challenge.paymentId,
      valid,
      headerPreview: header ? header.slice(0, 20) : "(empty)",
    }));
    return valid;
  }

  async payEndpoint(endpoint: string, amount: string, purpose: string): Promise<PaymentResult> {
    // Simulate payment processing delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    const result: PaymentResult = {
      paymentId: uuidv4(),
      txHash: `demo-tx-${uuidv4()}`,
      settled: true,
      demoMode: true,
    };

    console.log(JSON.stringify({
      level: "info",
      timestamp: new Date().toISOString(),
      message: "[x402/local] payment sent",
      endpoint,
      amount,
      purpose,
      txHash: result.txHash,
      paymentId: result.paymentId,
    }));

    return result;
  }
}
