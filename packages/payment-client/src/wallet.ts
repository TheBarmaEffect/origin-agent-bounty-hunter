import { v4 as uuidv4 } from "uuid";

export interface SignedPayment {
  authorization: string;
  amount: string;
  asset: string;
  network: string;
  payTo: string;
  agentId: string;
  nonce: string;
  timestamp: string;
  txHash?: string;
}

/**
 * Mock wallet for demo mode — produces a deterministic fake authorization.
 * No real on-chain transaction occurs.
 */
export class MockWallet {
  constructor(private readonly agentId: string) {}

  async signPayment(spec: {
    amount: string;
    asset: string;
    network: string;
    payTo: string;
  }): Promise<SignedPayment> {
    const nonce = uuidv4();
    const timestamp = new Date().toISOString();
    const authorization = Buffer.from(
      JSON.stringify({ agentId: this.agentId, nonce, timestamp, ...spec })
    ).toString("base64");

    return {
      authorization,
      amount: spec.amount,
      asset: spec.asset,
      network: spec.network,
      payTo: spec.payTo,
      agentId: this.agentId,
      nonce,
      timestamp,
    };
  }

  getDemoTxHash(): string {
    return `demo-tx-${uuidv4()}`;
  }
}

/**
 * Real wallet using the new Coinbase CDP SDK (@coinbase/cdp-sdk).
 *
 * Uses an existing funded EVM account (created by scripts/setupWallet.ts).
 * Calls account.transfer() to settle x402 payments via real on-chain USDC transfers
 * on Base Sepolia.
 *
 * Required env vars:
 *   CDP_API_KEY_ID       (UUID)
 *   CDP_API_KEY_SECRET   (base64 Ed25519 private key)
 *   CDP_WALLET_SECRET    (PEM-formatted wallet authorization key)
 *   AGENT_WALLET_ADDRESS (0x... — output of setupWallet.ts)
 */
export class CdpWallet {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private cdp: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private account: any = null;

  constructor(private readonly agentId: string) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getAccount(): Promise<any> {
    if (this.account) return this.account;

    const address = process.env.AGENT_WALLET_ADDRESS;
    if (!address) {
      throw new Error(
        "AGENT_WALLET_ADDRESS not set — run `npx tsx scripts/setupWallet.ts` first."
      );
    }

    // Mirror legacy aliases to canonical CDP SDK env vars
    process.env.CDP_API_KEY_ID = process.env.CDP_API_KEY_ID || process.env.CDP_API_KEY_NAME;
    process.env.CDP_API_KEY_SECRET =
      process.env.CDP_API_KEY_SECRET || process.env.CDP_API_KEY_PRIVATE_KEY;

    // Dynamic import keeps CDP SDK out of demo-mode bundles
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sdk: any = await import("@coinbase/cdp-sdk" as string as never);
    this.cdp = new sdk.CdpClient();
    this.account = await this.cdp.evm.getAccount({ address });
    return this.account;
  }

  /**
   * Make a real x402 payment by sending USDC on Base Sepolia.
   *
   * The x402 spec defines two settlement schemes:
   *   1. EIP-3009 transferWithAuthorization (off-chain signed, facilitator settles)
   *   2. Direct on-chain settlement (client submits the transfer itself)
   *
   * We implement scheme 2: the client transfers USDC directly, then sends the
   * tx hash in the x-payment header. The seller verifies by reading the chain.
   * This trades latency for simplicity (no facilitator needed).
   */
  async signPayment(spec: {
    amount: string; // micro-USDC as string, e.g. "1000" = 0.001 USDC
    asset: string;
    network: string;
    payTo: string;
    resource: string;
    maxTimeoutSeconds: number;
  }): Promise<SignedPayment> {
    const account = await this.getAccount();
    const nonce = uuidv4();
    const timestamp = new Date().toISOString();

    if (!spec.payTo || spec.payTo === "0x0000000000000000000000000000000000000000") {
      throw new Error(`Refusing to send USDC to invalid payTo: ${spec.payTo}`);
    }

    const microUsdc = BigInt(spec.amount);

    const result = await account.transfer({
      to: spec.payTo,
      amount: microUsdc,
      token: "usdc",
      network: "base-sepolia",
    });

    const txHash: string =
      result?.transactionHash ?? result?.hash ?? result?.txHash ?? "";

    if (!txHash) {
      throw new Error(
        `transfer() returned no tx hash. Raw: ${JSON.stringify(result).slice(0, 200)}`
      );
    }

    // Authorization payload: tx hash + metadata, base64-encoded for header transport
    const payload = {
      scheme: "onchain",
      from: account.address,
      to: spec.payTo,
      value: spec.amount,
      asset: spec.asset,
      network: spec.network,
      nonce,
      txHash,
      timestamp,
    };
    const authorization = Buffer.from(JSON.stringify(payload)).toString("base64");

    return {
      authorization,
      amount: spec.amount,
      asset: spec.asset,
      network: spec.network,
      payTo: spec.payTo,
      agentId: this.agentId,
      nonce,
      timestamp,
      txHash,
    };
  }
}
