/**
 * One-shot script that:
 *   1. Generates a fresh EOA private key
 *   2. Funds it from the CDP agent wallet (ETH for gas)
 *   3. Writes VERDICT_PRIVATE_KEY to .env
 * Run: npx tsx scripts/setupVerdictDeployer.ts
 */
import { config } from "dotenv";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

config();

process.env.CDP_API_KEY_ID = process.env.CDP_API_KEY_ID || process.env.CDP_API_KEY_NAME;
process.env.CDP_API_KEY_SECRET = process.env.CDP_API_KEY_SECRET || process.env.CDP_API_KEY_PRIVATE_KEY;

const ENV_PATH = resolve(__dirname, "..", ".env");

function upsertEnvVar(key: string, value: string) {
  const content = readFileSync(ENV_PATH, "utf8");
  const re = new RegExp(`^${key}=.*$`, "m");
  const line = `${key}=${value}`;
  const next = re.test(content)
    ? content.replace(re, line)
    : `${content.replace(/\s*$/, "")}\n${line}\n`;
  writeFileSync(ENV_PATH, next, "utf8");
  console.log(`  → wrote ${key} to .env`);
}

async function main() {
  if (!process.env.AGENT_WALLET_ADDRESS) {
    console.error("❌ AGENT_WALLET_ADDRESS not set. Run scripts/setupWallet.ts first.");
    process.exit(1);
  }

  // Reuse existing key if already generated
  let pk = process.env.VERDICT_PRIVATE_KEY as `0x${string}` | undefined;
  let deployer;
  if (pk) {
    deployer = privateKeyToAccount(pk);
    console.log(`Reusing existing deployer: ${deployer.address}`);
  } else {
    pk = generatePrivateKey();
    deployer = privateKeyToAccount(pk);
    console.log(`Generated deployer: ${deployer.address}`);
    upsertEnvVar("VERDICT_PRIVATE_KEY", pk);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sdk: any = await import("@coinbase/cdp-sdk" as string as never);
  const cdp = new sdk.CdpClient();
  const account = await cdp.evm.getAccount({ address: process.env.AGENT_WALLET_ADDRESS });

  console.log("Funding deployer with 0.00005 ETH for contract deploy gas...");
  // 0.00005 ETH = 50_000_000_000_000 wei
  const result = await account.transfer({
    to: deployer.address,
    amount: 50_000_000_000_000n,
    token: "eth",
    network: "base-sepolia",
  });
  const txHash = result?.transactionHash ?? result?.hash ?? result?.txHash;
  console.log(`  ✅ funded — tx: https://sepolia.basescan.org/tx/${txHash}`);

  console.log(`\nDeployer ready: ${deployer.address}`);
  console.log(`Next: cd packages/contracts && npm run deploy:sepolia`);
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
