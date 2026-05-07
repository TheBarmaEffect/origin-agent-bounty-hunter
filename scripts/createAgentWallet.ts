/**
 * One-shot script to create a CDP wallet on Base Sepolia.
 *
 * Run: cd /Users/hungrycheetah/Documents/origin-agent-bounty-hunter && npx tsx scripts/createAgentWallet.ts
 *
 * Outputs: wallet address + encrypted seed.
 * Save the seed to AGENT_WALLET_SEED in .env (never commit).
 */
import { config } from "dotenv";
config();

async function main() {
  const apiKeyName = process.env.CDP_API_KEY_NAME || process.env.CDP_API_KEY_ID;
  const privateKey = process.env.CDP_API_KEY_PRIVATE_KEY || process.env.CDP_API_KEY_SECRET;

  if (!apiKeyName || !privateKey) {
    console.error("[create-wallet] Missing CDP_API_KEY_NAME or CDP_API_KEY_PRIVATE_KEY in .env");
    process.exit(1);
  }

  console.log("[create-wallet] using API key:", apiKeyName);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sdk: any = await import("@coinbase/coinbase-sdk");
  const { Coinbase, Wallet } = sdk;

  try {
    Coinbase.configure({ apiKeyName, privateKey });
  } catch (err) {
    console.error("[create-wallet] Coinbase.configure failed:", (err as Error).message);
    console.error("[create-wallet] If error mentions PEM format, install the new CDP SDK:");
    console.error("                npm install @coinbase/cdp-sdk -w packages/payment-client");
    process.exit(2);
  }

  console.log("[create-wallet] creating wallet on base-sepolia...");
  const wallet = await Wallet.create({ networkId: "base-sepolia" });

  const defaultAddr = await wallet.getDefaultAddress();
  const address = typeof defaultAddr === "string" ? defaultAddr : defaultAddr.getId?.() ?? defaultAddr.id;

  // Export seed for storage
  const exported = wallet.export();
  const seed = typeof exported === "string" ? exported : exported?.seed;

  console.log("\n=========================================");
  console.log("✅ Wallet created on Base Sepolia");
  console.log("=========================================");
  console.log("Address:", address);
  console.log("Seed:   ", seed);
  console.log("=========================================\n");

  console.log("👉 Add to .env:");
  console.log(`AGENT_WALLET_ADDRESS=${address}`);
  console.log(`AGENT_WALLET_SEED=${seed}`);
  console.log("");

  // Try to claim testnet ETH from faucet (only ETH — USDC requires Circle faucet)
  try {
    console.log("[create-wallet] requesting testnet ETH from CDP faucet...");
    const faucetTx = await wallet.faucet();
    console.log("[create-wallet] faucet tx:", faucetTx.getTransactionHash?.() ?? faucetTx);
    console.log("[create-wallet] ✅ ETH faucet successful");
  } catch (err) {
    console.warn("[create-wallet] ⚠️  ETH faucet failed:", (err as Error).message);
  }

  console.log("\n📌 Next: USDC must be funded MANUALLY:");
  console.log("   1. Visit https://faucet.circle.com");
  console.log("   2. Select Base Sepolia network");
  console.log(`   3. Paste address: ${address}`);
  console.log("   4. Confirm transaction (requires browser + wallet sig or captcha)");
}

main().catch((err) => {
  console.error("[create-wallet] FAILED:", err);
  process.exit(1);
});
