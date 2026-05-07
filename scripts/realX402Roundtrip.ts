/**
 * End-to-end real x402 payment roundtrip on Base Sepolia.
 *
 *   1. Boots the x402-seller in real mode (no MOCK_X402)
 *   2. Configures it to accept payment to AGENT_WALLET_ADDRESS (self-pay so we
 *      can verify without separate seller wallet funding)
 *   3. Uses OriginPaymentClient with MOCK_X402=false to fetch the gated endpoint
 *   4. Client gets 402 → makes real on-chain USDC transfer → retries
 *   5. Seller verifies the tx via Base Sepolia RPC → returns DeFi data
 *
 * Run: npx tsx scripts/realX402Roundtrip.ts
 */
import { config } from "dotenv";
import { spawn, ChildProcess } from "child_process";
import { resolve } from "path";

config();

process.env.CDP_API_KEY_ID = process.env.CDP_API_KEY_ID || process.env.CDP_API_KEY_NAME;
process.env.CDP_API_KEY_SECRET =
  process.env.CDP_API_KEY_SECRET || process.env.CDP_API_KEY_PRIVATE_KEY;

const SELLER_PORT = 3007;
const SELLER_URL = `http://127.0.0.1:${SELLER_PORT}/data/defi-protocols`;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForSeller(child: ChildProcess) {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${SELLER_PORT}/health`);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    if (child.exitCode !== null) {
      throw new Error(`seller exited early with code ${child.exitCode}`);
    }
    await sleep(250);
  }
  throw new Error("seller did not start in time");
}

async function main() {
  if (!process.env.AGENT_WALLET_ADDRESS) {
    console.error("❌ AGENT_WALLET_ADDRESS not set. Run scripts/setupWallet.ts first.");
    process.exit(1);
  }

  // Self-pay: route the seller's payTo to our own wallet so the test only
  // needs one funded account. The on-chain log is still real.
  const payTo = process.env.AGENT_WALLET_ADDRESS;

  console.log("🔧 Step 1/5: Starting x402-seller in real mode...");
  const sellerCwd = resolve(__dirname, "..", "apps", "x402-seller");
  const seller = spawn(
    "npx",
    ["tsx", "src/localServer.ts"],
    {
      cwd: sellerCwd,
      env: {
        ...process.env,
        PORT: String(SELLER_PORT),
        MOCK_X402: "false",
        WALLET_ADDRESS: payTo,
        PAYMENT_AMOUNT_USDC_MICRO: "1000",
      },
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  seller.stdout?.on("data", (d) =>
    process.stdout.write(`  [seller] ${d.toString().trim()}\n`)
  );
  seller.stderr?.on("data", (d) =>
    process.stderr.write(`  [seller-err] ${d.toString().trim()}\n`)
  );

  try {
    await waitForSeller(seller);
    console.log(`  ✅ seller up at ${SELLER_URL}\n`);

    console.log("🔍 Step 2/5: Probing endpoint without payment header...");
    const probe = await fetch(SELLER_URL);
    console.log(`  status=${probe.status}`);
    const probeBody = await probe.json();
    console.log(`  payTo=${probeBody?.accepts?.[0]?.payTo}`);
    console.log(`  amount=${probeBody?.accepts?.[0]?.maxAmountRequired} micro-USDC\n`);

    if (probe.status !== 402) {
      throw new Error(`expected 402, got ${probe.status}`);
    }

    console.log("💸 Step 3/5: Fetching via OriginPaymentClient (real CDP payment)...");
    process.env.MOCK_X402 = "false";
    process.env.DEMO_MODE = "false";
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { OriginPaymentClient } = require("../packages/payment-client/src/client");
    const client = new OriginPaymentClient("smoke-test", 0.5);

    const result = await client.fetch(SELLER_URL);

    console.log(`  ✅ data fetched`);
    console.log(`     amountPaid=${result.amountPaid} USDC`);
    console.log(`     txHash=${result.receipt.txHash}`);
    console.log(`     remainingBudget=${result.remainingBudget} USDC\n`);

    console.log("📦 Step 4/5: Verifying received data...");
    const data = result.data as Array<{ protocol: string; tvl: number }>;
    console.log(`  ✅ got ${Array.isArray(data) ? data.length : "?"} protocols`);
    if (Array.isArray(data) && data.length > 0) {
      console.log(`     first: ${data[0].protocol} (TVL=$${data[0].tvl.toLocaleString()})`);
    }
    console.log("");

    console.log("🔗 Step 5/5: Confirming on-chain settlement...");
    console.log(
      `  Tx: https://sepolia.basescan.org/tx/${result.receipt.txHash}`
    );

    console.log("\n=========================================");
    console.log("✅ Real x402 roundtrip complete");
    console.log("=========================================");
    console.log(`Endpoint:  ${SELLER_URL}`);
    console.log(`From:      ${process.env.AGENT_WALLET_ADDRESS}`);
    console.log(`To:        ${payTo}`);
    console.log(`Amount:    ${result.amountPaid} USDC`);
    console.log(`Tx:        https://sepolia.basescan.org/tx/${result.receipt.txHash}`);
    console.log(`Data:      ${Array.isArray(data) ? data.length : 0} protocols received`);
    console.log("=========================================\n");
  } finally {
    seller.kill("SIGTERM");
    await sleep(300);
  }
}

main().catch((err) => {
  console.error("❌ FAILED:", err);
  process.exit(1);
});
