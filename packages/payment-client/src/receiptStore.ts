import { createHash } from "crypto";
import type { PaymentReceipt } from "./types";

/**
 * In-memory receipt store for demo mode.
 * Production: swap DynamoDB writes in OriginPaymentClient.recordReceipt()
 */
export class InMemoryReceiptStore {
  private receipts: PaymentReceipt[] = [];

  async write(receipt: PaymentReceipt): Promise<void> {
    this.receipts.push(receipt);
  }

  async getByAgent(agentId: string): Promise<PaymentReceipt[]> {
    return this.receipts.filter((r) => r.agentId === agentId);
  }

  async getAll(): Promise<PaymentReceipt[]> {
    return [...this.receipts];
  }
}

export function hashReceipt(receipt: Omit<PaymentReceipt, "receiptHash">): string {
  const canonical = JSON.stringify({
    url: receipt.url,
    amount: receipt.amount,
    txHash: receipt.txHash,
    timestamp: receipt.timestamp,
    agentId: receipt.agentId,
  });
  return createHash("sha256").update(canonical).digest("hex");
}
