/**
 * One-shot CDP wallet setup for Base Sepolia.
 *
 * Reads CDP_API_KEY_ID, CDP_API_KEY_SECRET, CDP_WALLET_SECRET from .env.
 * Creates an EVM account, funds with ETH + USDC from the CDP faucet,
 * confirms balances, and writes AGENT_WALLET_ADDRESS back to .env.
 *
 * Run: npx tsx scripts/setupWallet.ts
 */
import { config } from "dotenv";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

config();

// CDP SDK reads CDP_API_KEY_ID / CDP_API_KEY_SECRET / CDP_WALLET_SECRET from env.
// We've also stored aliases (CDP_API_KEY_NAME / CDP_API_KEY_PRIVATE_KEY) — mirror them.
process.env.CDP_API_KEY_ID = process.env.CDP_API_KEY_ID || process.env.CDP_API_KEY_NAME;
process.env.CDP_API_KEY_SECRET = process.env.CDP_API_KEY_SECRET || process.env.CDP_API_KEY_PRIVATE_KEY;

const ENV_PATH = resolve(__dirname, "..", ".env");

function upsertEnvVar(key: string, value: string): void {
  const content = readFileSync(ENV_PATH, "utf8");
  const re = new RegExp(`^${key}=.*$`, "m");
  const line = `${key}=${value}`;
  const next = re.test(content)
    ? content.replace(re, line)
    : `${content.replace(/\s*$/, "")}\n${line}\n`;
  writeFileSync(ENV_PATH, next, "utf8");
  console.log(`  → wrote ${key} to .env`);
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (!process.env.CDP_API_KEY_ID || !process.env.CDP_API_KEY_SECRET) {
    console.error("❌ Missing CDP_API_KEY_ID or CDP_API_KEY_SECRET in .env");
    process.exit(1);
  }
  if (!process.env.CDP_WALLET_SECRET) {
    console.error("❌ Missing CDP_WALLET_SECRET in .env");
    console.error("   Generate one at https://portal.cdp.coinbase.com → Server Wallets → Wallet Secret");
    process.exit(1);
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
  const { CdpClient }: any = require("@coinbase/cdp-sdk");

  const cdp = new CdpClient();

  console.log("🔧 Step 1/5: Creating EVM account...");
  const account = await cdp.evm.createAccount();
  const address: string = account.address;
  console.log(`  ✅ Account created: ${address}\n`);

  console.log("💧 Step 2/5: Requesting testnet ETH from CDP faucet...");
  try {
    const ethRes = await cdp.evm.requestFaucet({
      address,
      network: "base-sepolia",
      token: "eth",
    });
    console.log(`  ✅ ETH faucet tx: ${ethRes?.transactionHash ?? JSON.stringify(ethRes)}\n`);
  } catch (err) {
    console.error(`  ⚠️  ETH faucet failed: ${(err as Error).message}\n`);
  }

  console.log("💧 Step 3/5: Requesting testnet USDC from CDP faucet...");
  try {
    const usdcRes = await cdp.evm.requestFaucet({
      address,
      network: "base-sepolia",
      token: "usdc",
    });
    console.log(`  ✅ USDC faucet tx: ${usdcRes?.transactionHash ?? JSON.stringify(usdcRes)}\n`);
  } catch (err) {
    console.error(`  ⚠️  USDC faucet failed: ${(err as Error).message}\n`);
  }

  console.log("📝 Step 4/5: Saving WALLET_ADDRESS to .env...");
  console.log(`WALLET_ADDRESS=${address}`);
  upsertEnvVar("AGENT_WALLET_ADDRESS", address);
  console.log("");

  console.log("⏳ Step 5/5: Waiting 5s for faucet confirmations, then checking balances...");
  await sleep(5000);

  try {
    const balances = await cdp.evm.listTokenBalances({
      address,
      network: "base-sepolia",
    });
    const items: Array<{ token?: { symbol?: string; contractAddress?: string }; amount?: { amount?: string; decimals?: number } }> =
      balances?.balances ?? [];

    if (items.length === 0) {
      console.log("  ⚠️  No balances found yet (faucet may still be confirming on-chain).");
    } else {
      for (const item of items) {
        const sym = item.token?.symbol ?? "(unknown)";
        const raw = BigInt(item.amount?.amount ?? "0");
        const decimals = item.amount?.decimals ?? 18;
        const human = Number(raw) / 10 ** decimals;
        console.log(`  ${sym.padEnd(6)} ${human.toFixed(6)}`);
      }
    }
  } catch (err) {
    console.error(`  ⚠️  Balance check failed: ${(err as Error).message}`);
  }

  console.log("\n=========================================");
  console.log("✅ Wallet setup complete");
  console.log("=========================================");
  console.log(`Address: ${address}`);
  console.log(`Explorer: https://sepolia.basescan.org/address/${address}`);
  console.log("=========================================\n");
}

main().catch((err) => {
  console.error("❌ FAILED:", err);
  process.exit(1);
});
