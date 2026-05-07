/**
 * Real on-chain USDC payment helper using the new Coinbase CDP SDK.
 *
 * Reads CDP_API_KEY_ID, CDP_API_KEY_SECRET, CDP_WALLET_SECRET, AGENT_WALLET_ADDRESS
 * from process.env. Used to settle:
 *   - bounty fund (user/Origin escrow ← agent wallet)
 *   - winner payout (winner ← escrow)
 *   - per-agent x402 fetch (data seller ← agent)
 *
 * In demo/mock mode, returns a fake tx hash without touching chain.
 */
const REAL_PAYMENTS = process.env.REAL_PAYMENTS === "true";

let _account: any = null;

async function getAccount(): Promise<any> {
  if (_account) return _account;
  const address = process.env.AGENT_WALLET_ADDRESS;
  if (!address) throw new Error("AGENT_WALLET_ADDRESS not set");

  // Mirror legacy env var aliases
  process.env.CDP_API_KEY_ID = process.env.CDP_API_KEY_ID || process.env.CDP_API_KEY_NAME;
  process.env.CDP_API_KEY_SECRET = process.env.CDP_API_KEY_SECRET || process.env.CDP_API_KEY_PRIVATE_KEY;

  const sdk: any = await import("@coinbase/cdp-sdk" as string as never);
  const cdp = new sdk.CdpClient();
  _account = await cdp.evm.getAccount({ address });
  return _account;
}

export interface PayResult {
  txHash: string;
  real: boolean;
  durationMs: number;
}

/**
 * Send USDC on Base Sepolia. Amount in human-readable USDC (e.g. 0.001).
 * Returns a real tx hash when REAL_PAYMENTS=true and CDP creds present;
 * else returns a deterministic fake hash so demos still flow.
 */
export async function sendUsdc(opts: {
  to: string;
  amountUsdc: number;
  purpose: string;
}): Promise<PayResult> {
  const start = Date.now();

  if (!REAL_PAYMENTS) {
    // Demo mode — deterministic fake tx hash
    const fake = `0xdemo-${Math.random().toString(16).slice(2, 10)}${Date.now().toString(16)}`;
    return { txHash: fake, real: false, durationMs: Date.now() - start };
  }

  const account = await getAccount();

  // micro-USDC (6 decimals)
  const microUsdc = BigInt(Math.round(opts.amountUsdc * 1_000_000));

  const result = await account.transfer({
    to: opts.to,
    amount: microUsdc,
    token: "usdc",
    network: "base-sepolia",
  });

  const txHash: string =
    result?.transactionHash ?? result?.hash ?? result?.txHash ?? "";

  if (!txHash) {
    throw new Error(
      `CDP transfer returned no tx hash for ${opts.purpose}. Raw: ${JSON.stringify(result).slice(0, 200)}`
    );
  }

  console.log(JSON.stringify({
    level: "info",
    timestamp: new Date().toISOString(),
    message: "[cdp-payer] USDC sent",
    purpose: opts.purpose,
    to: opts.to,
    amount: opts.amountUsdc,
    txHash,
  }));

  return { txHash, real: true, durationMs: Date.now() - start };
}

/** Best-effort fetch of an EOA's USDC balance. */
export async function getUsdcBalance(): Promise<number | null> {
  if (!REAL_PAYMENTS) return null;
  try {
    const account = await getAccount();
    const balances = await account.listTokenBalances({ network: "base-sepolia" });
    for (const b of balances?.balances ?? []) {
      if ((b.token?.symbol ?? "").toUpperCase() === "USDC") {
        const raw = BigInt(b.amount?.amount ?? "0");
        const decimals = b.amount?.decimals ?? 6;
        return Number(raw) / 10 ** decimals;
      }
    }
    return 0;
  } catch {
    return null;
  }
}
