/**
 * Real x402-style USDC payment on Base Sepolia.
 *
 * Sends a small USDC transfer from the funded agent wallet to a recipient
 * (defaults to the demo PAID_DATA_SELLER_WALLET). Proves the wallet
 * is wired correctly for real x402 payments per Prompt 2 acceptance criteria.
 *
 * Run: npx tsx scripts/realUsdcPayment.ts
 */
import { config } from "dotenv";
config();

process.env.CDP_API_KEY_ID = process.env.CDP_API_KEY_ID || process.env.CDP_API_KEY_NAME;
process.env.CDP_API_KEY_SECRET = process.env.CDP_API_KEY_SECRET || process.env.CDP_API_KEY_PRIVATE_KEY;

const RECIPIENT =
  process.env.PAID_DATA_SELLER_WALLET ||
  "0x0000000000000000000000000000000000000001";
const AMOUNT_USDC_HUMAN = "0.001"; // human-readable
const AMOUNT_MICRO_USDC = 1000n; // 0.001 USDC at 6 decimals

async function main() {
  if (!process.env.AGENT_WALLET_ADDRESS) {
    console.error("❌ AGENT_WALLET_ADDRESS not set. Run scripts/setupWallet.ts first.");
    process.exit(1);
  }
  if (!process.env.CDP_WALLET_SECRET) {
    console.error("❌ CDP_WALLET_SECRET not set in .env.");
    process.exit(1);
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
  const { CdpClient }: any = require("@coinbase/cdp-sdk");
  const cdp = new CdpClient();

  console.log(`🔧 Loading account: ${process.env.AGENT_WALLET_ADDRESS}`);
  const account = await cdp.evm.getAccount({
    address: process.env.AGENT_WALLET_ADDRESS,
  });

  console.log(`💰 Pre-payment balance check...`);
  const before = await account.listTokenBalances({ network: "base-sepolia" });
  for (const b of before?.balances ?? []) {
    const sym = b.token?.symbol ?? "?";
    const raw = BigInt(b.amount?.amount ?? "0");
    const decimals = b.amount?.decimals ?? 18;
    console.log(`   ${sym.padEnd(6)} ${(Number(raw) / 10 ** decimals).toFixed(6)}`);
  }

  console.log(`\n💸 Sending ${AMOUNT_USDC_HUMAN} USDC to ${RECIPIENT}...`);
  const result = await account.transfer({
    to: RECIPIENT,
    amount: AMOUNT_MICRO_USDC,
    token: "usdc",
    network: "base-sepolia",
  });

  // result shape varies — try several known fields
  const txHash =
    result?.transactionHash ?? result?.hash ?? result?.txHash ?? JSON.stringify(result);

  console.log(`\n✅ Transfer broadcast`);
  console.log(`   Tx hash: ${txHash}`);
  console.log(`   Explorer: https://sepolia.basescan.org/tx/${txHash}`);

  console.log(`\n⏳ Waiting 8s for confirmation...`);
  await new Promise((r) => setTimeout(r, 8000));

  console.log(`\n💰 Post-payment balance:`);
  const after = await account.listTokenBalances({ network: "base-sepolia" });
  for (const b of after?.balances ?? []) {
    const sym = b.token?.symbol ?? "?";
    const raw = BigInt(b.amount?.amount ?? "0");
    const decimals = b.amount?.decimals ?? 18;
    console.log(`   ${sym.padEnd(6)} ${(Number(raw) / 10 ** decimals).toFixed(6)}`);
  }

  console.log(`\n=========================================`);
  console.log(`✅ Real Base Sepolia USDC payment complete`);
  console.log(`=========================================`);
  console.log(`From:    ${process.env.AGENT_WALLET_ADDRESS}`);
  console.log(`To:      ${RECIPIENT}`);
  console.log(`Amount:  ${AMOUNT_USDC_HUMAN} USDC`);
  console.log(`Tx:      https://sepolia.basescan.org/tx/${txHash}`);
  console.log(`=========================================\n`);
}

main().catch((err) => {
  console.error("❌ FAILED:", err);
  process.exit(1);
});
