// TODO: Install x402-express for server-side seller routes
// TODO: Install x402-fetch or @coinbase/x402 for buyer-side payments
// TODO: Configure X402_FACILITATOR_URL, CDP_API_KEY_ID, CDP_API_KEY_SECRET in env
// Reference: https://github.com/coinbase/x402
//
// Example setup:
//   npm install x402-express x402-fetch
//   export X402_FACILITATOR_URL=https://x402.org/facilitator
//   export CDP_API_KEY_ID=your-key-id
//   export CDP_API_KEY_SECRET=your-key-secret
//   export PAYMENT_ADDRESS=0xYourWalletAddress

import type { X402Adapter, PaymentChallenge, PaymentResult } from "./x402Adapter";

class NotImplementedError extends Error {
  constructor(method: string) {
    super(
      `RealX402Adapter.${method} not implemented. ` +
        "Install x402-express and @coinbase/x402, then configure CDP_API_KEY_ID, " +
        "CDP_API_KEY_SECRET, X402_FACILITATOR_URL, and PAYMENT_ADDRESS environment variables."
    );
    this.name = "NotImplementedError";
  }
}

export class RealX402Adapter implements X402Adapter {
  async createChallenge(_amount: string, _purpose: string): Promise<PaymentChallenge> {
    throw new NotImplementedError("createChallenge");
  }

  async verifyPayment(_header: string, _challenge: PaymentChallenge): Promise<boolean> {
    throw new NotImplementedError("verifyPayment");
  }

  async payEndpoint(_endpoint: string, _amount: string, _purpose: string): Promise<PaymentResult> {
    throw new NotImplementedError("payEndpoint");
  }
}
