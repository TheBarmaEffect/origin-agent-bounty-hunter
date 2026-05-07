import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import { BudgetExceededError, PaymentFailedError } from "./types";
import type { PaymentReceipt, X402PaymentSpec, FetchResult } from "./types";
import { InMemoryReceiptStore, hashReceipt } from "./receiptStore";
import { DynamoReceiptStore } from "./dynamoStore";
import { MockWallet, CdpWallet } from "./wallet";

const MOCK_X402 = process.env.MOCK_X402 === "true";
const FACILITATOR_URL =
  process.env.FACILITATOR_URL || "https://x402.org/facilitator";
const DYNAMO_TABLE = process.env.DYNAMODB_TABLE || "";

function log(msg: string, meta?: Record<string, unknown>) {
  console.log(JSON.stringify({ level: "info", timestamp: new Date().toISOString(), message: msg, ...meta }));
}

export class OriginPaymentClient {
  private readonly agentId: string;
  private budgetUsdc: number;
  private readonly receipts: InMemoryReceiptStore;
  private readonly dynamo: DynamoReceiptStore | null;
  private readonly wallet: MockWallet | CdpWallet;

  constructor(agentId: string, budgetUsdc: number) {
    this.agentId = agentId;
    this.budgetUsdc = budgetUsdc;
    this.receipts = new InMemoryReceiptStore();
    this.dynamo = DYNAMO_TABLE ? new DynamoReceiptStore(DYNAMO_TABLE) : null;
    this.wallet = MOCK_X402 ? new MockWallet(agentId) : new CdpWallet(agentId);
  }

  async fetch<T = unknown>(url: string): Promise<FetchResult<T>> {
    if (MOCK_X402) {
      return this.fetchMock<T>(url);
    }
    return this.fetchReal<T>(url);
  }

  private async fetchMock<T>(url: string): Promise<FetchResult<T>> {
    log("[payment-client] MOCK_X402 active — skipping real payment", { agentId: this.agentId, url });

    const res = await axios.get<T>(url, { validateStatus: () => true });
    if (res.status !== 200) {
      throw new PaymentFailedError(url, `Unexpected status ${res.status} in mock mode`);
    }

    const mockWallet = this.wallet as MockWallet;
    const txHash = mockWallet.getDemoTxHash();
    const amount = 0.001; // mock cost in USDC

    const receipt = this.buildReceipt(url, amount, txHash);
    await this.recordReceipt(receipt);

    return { data: res.data, receipt, amountPaid: amount, remainingBudget: this.budgetUsdc };
  }

  private async fetchReal<T>(url: string): Promise<FetchResult<T>> {
    // Step 1: probe the endpoint
    const probe = await axios.get(url, { validateStatus: () => true });

    if (probe.status === 200) {
      // No payment required — free endpoint
      const txHash = `free-${uuidv4()}`;
      const receipt = this.buildReceipt(url, 0, txHash);
      await this.recordReceipt(receipt);
      return { data: probe.data as T, receipt, amountPaid: 0, remainingBudget: this.budgetUsdc };
    }

    if (probe.status !== 402) {
      throw new PaymentFailedError(url, `Unexpected status ${probe.status}`);
    }

    // Step 2: parse payment spec from 402 body
    const spec = probe.data as X402PaymentSpec;
    if (!spec?.accepts?.length) {
      throw new PaymentFailedError(url, "Invalid payment spec — no accepts array");
    }

    const paymentOption = spec.accepts[0];
    const amountRequired = Number(paymentOption.maxAmountRequired) / 1_000_000; // micro-USDC → USDC

    log("[payment-client] 402 received", {
      agentId: this.agentId,
      url,
      amountRequired,
      payTo: paymentOption.payTo,
      asset: paymentOption.asset,
    });

    // Step 3: budget check
    if (amountRequired > this.budgetUsdc) {
      throw new BudgetExceededError(amountRequired, this.budgetUsdc);
    }

    // Step 4: settle on-chain via CDP wallet (real USDC transfer on Base Sepolia)
    const cdpWallet = this.wallet as CdpWallet;
    const signed = await cdpWallet.signPayment({
      amount: paymentOption.maxAmountRequired,
      asset: paymentOption.asset,
      network: paymentOption.network,
      payTo: paymentOption.payTo,
      resource: paymentOption.resource,
      maxTimeoutSeconds: paymentOption.maxTimeoutSeconds,
    });

    const xPaymentHeader = JSON.stringify({
      x402Version: spec.x402Version,
      scheme: paymentOption.scheme,
      network: paymentOption.network,
      payload: signed.authorization,
    });

    const txHash: string = signed.txHash || `unknown-${uuidv4()}`;

    log("[payment-client] on-chain payment settled", {
      agentId: this.agentId,
      nonce: signed.nonce,
      payTo: signed.payTo,
      txHash,
      explorer: `https://sepolia.basescan.org/tx/${txHash}`,
    });

    // Step 5: retry original endpoint with payment header
    const paid = await axios.get<T>(url, {
      headers: { "x-payment": xPaymentHeader },
      validateStatus: () => true,
    });

    if (paid.status !== 200) {
      throw new PaymentFailedError(url, `Endpoint rejected after payment: status ${paid.status}`);
    }

    // Step 7: deduct budget and record receipt
    this.budgetUsdc -= amountRequired;
    const receipt = this.buildReceipt(url, amountRequired, txHash);
    await this.recordReceipt(receipt);

    log("[payment-client] payment complete", {
      agentId: this.agentId,
      amountPaid: amountRequired,
      remainingBudget: this.budgetUsdc,
      txHash,
    });

    return { data: paid.data, receipt, amountPaid: amountRequired, remainingBudget: this.budgetUsdc };
  }

  async getBudgetRemaining(): Promise<number> {
    return this.budgetUsdc;
  }

  async getSpendHistory(): Promise<PaymentReceipt[]> {
    return this.receipts.getByAgent(this.agentId);
  }

  private buildReceipt(url: string, amount: number, txHash: string): PaymentReceipt {
    const partial = {
      url,
      amount,
      txHash,
      timestamp: new Date().toISOString(),
      agentId: this.agentId,
    };
    return { ...partial, receiptHash: hashReceipt(partial) };
  }

  private async recordReceipt(receipt: PaymentReceipt): Promise<void> {
    await this.receipts.write(receipt);
    if (this.dynamo) {
      try {
        await this.dynamo.write(receipt);
      } catch (err) {
        // DynamoDB write failure is non-fatal in demo mode
        log("[payment-client] DynamoDB write failed (non-fatal)", {
          agentId: this.agentId,
          error: (err as Error).message,
        });
      }
    }
  }
}
