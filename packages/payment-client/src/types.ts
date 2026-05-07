export interface PaymentReceipt {
  url: string;
  amount: number;
  txHash: string;
  timestamp: string;
  agentId: string;
  receiptHash: string;
}

export interface X402PaymentSpec {
  x402Version: number;
  accepts: Array<{
    scheme: string;
    network: string;
    maxAmountRequired: string;
    resource: string;
    description: string;
    mimeType: string;
    payTo: string;
    maxTimeoutSeconds: number;
    asset: string;
    extra?: Record<string, string>;
  }>;
}

export interface FetchResult<T = unknown> {
  data: T;
  receipt: PaymentReceipt;
  amountPaid: number;
  remainingBudget: number;
}

export class BudgetExceededError extends Error {
  constructor(required: number, remaining: number) {
    super(
      `Budget exceeded: payment requires ${required} USDC but only ${remaining} USDC remaining`
    );
    this.name = "BudgetExceededError";
  }
}

export class PaymentFailedError extends Error {
  constructor(url: string, reason: string) {
    super(`Payment failed for ${url}: ${reason}`);
    this.name = "PaymentFailedError";
  }
}
