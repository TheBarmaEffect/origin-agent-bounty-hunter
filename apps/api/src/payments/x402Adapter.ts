export interface PaymentChallenge {
  paymentId: string;
  amount: string;
  asset: "USDC";
  network: "eip155:84532";
  payTo: string;
  expiresAt: string;
}

export interface PaymentResult {
  paymentId: string;
  txHash: string;
  settled: boolean;
  demoMode: boolean;
}

export interface X402Adapter {
  createChallenge(amount: string, purpose: string): Promise<PaymentChallenge>;
  verifyPayment(header: string, challenge: PaymentChallenge): Promise<boolean>;
  payEndpoint(endpoint: string, amount: string, purpose: string): Promise<PaymentResult>;
}

const DEMO_MODE = process.env.DEMO_MODE !== "false";

export function getX402Adapter(): X402Adapter {
  if (DEMO_MODE) {
    const { LocalX402Adapter } = require("./localAdapter") as { LocalX402Adapter: new () => X402Adapter };
    return new LocalX402Adapter();
  }
  const { RealX402Adapter } = require("./realAdapter") as { RealX402Adapter: new () => X402Adapter };
  return new RealX402Adapter();
}
