// Publishes verdict to Base Sepolia OriginVerdictRegistry contract.
// Skips gracefully if contract is not deployed yet.
import type { Verdict } from "@origin/shared";

const REGISTRY_ABI = [
  {
    type: "function",
    name: "publishVerdict",
    stateMutability: "nonpayable",
    inputs: [
      { name: "bountyId", type: "string" },
      { name: "verdictHash", type: "bytes32" },
      { name: "winnerAgentId", type: "string" },
      { name: "problemType", type: "string" },
      { name: "payoutAmount", type: "uint256" },
      { name: "payoutAsset", type: "string" },
    ],
    outputs: [],
  },
] as const;

export async function publishVerdict(verdict: Verdict, verdictHash: string): Promise<string | null> {
  const contract = process.env.VERDICT_CONTRACT_ADDRESS;
  const pk = process.env.VERDICT_PRIVATE_KEY;
  if (!contract || !pk) {
    console.log(JSON.stringify({
      level: "info",
      timestamp: new Date().toISOString(),
      message: "[proof] verdict publish skipped — contract not deployed",
      verdictHash, bountyId: verdict.bountyId,
      hint: "Deploy OriginVerdictRegistry and set VERDICT_CONTRACT_ADDRESS + VERDICT_PRIVATE_KEY to enable.",
    }));
    return null;
  }

  try {
    const { createWalletClient, createPublicClient, http, parseUnits } = await import("viem");
    const { baseSepolia } = await import("viem/chains");
    const { privateKeyToAccount } = await import("viem/accounts");

    const account = privateKeyToAccount(pk as `0x${string}`);
    const wallet = createWalletClient({
      account, chain: baseSepolia,
      transport: http(process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org"),
    });
    const pub = createPublicClient({
      chain: baseSepolia,
      transport: http(process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org"),
    });

    const payoutAmount = parseUnits(verdict.payout?.amount ?? "0", 6);

    const txHash = await wallet.writeContract({
      address: contract as `0x${string}`,
      abi: REGISTRY_ABI,
      functionName: "publishVerdict",
      args: [
        verdict.bountyId,
        `0x${verdictHash}` as `0x${string}`,
        verdict.actualWinnerAgentId,
        verdict.problemType,
        payoutAmount,
        "USDC",
      ],
    });

    await pub.waitForTransactionReceipt({ hash: txHash });

    console.log(JSON.stringify({
      level: "info", timestamp: new Date().toISOString(),
      message: "[proof] verdict published on-chain",
      txHash, contract, bountyId: verdict.bountyId, verdictHash,
    }));
    return txHash;
  } catch (err) {
    console.warn("[proof] chain publish failed (non-fatal):", (err as Error).message);
    return null;
  }
}
