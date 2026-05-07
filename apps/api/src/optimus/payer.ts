import { createHash } from "crypto";
import type { AgentId, PayoutRecord } from "@origin/shared";
import { getX402Adapter } from "../payments/x402Adapter";

const DEMO_MODE = process.env.DEMO_MODE !== "false";
const PAYMENT_FROM = process.env.PAYMENT_ADDRESS || "0x0000000000000000000000000000000000000001";

/** Generate a deterministic demo wallet address for an agent (based on agentId hash). */
function agentWalletAddress(agentId: AgentId): string {
  const hash = createHash("sha256").update(`agent-wallet-${agentId}`).digest("hex");
  return `0x${hash.slice(0, 40)}`;
}

export async function payWinner(agentId: AgentId, amount: number): Promise<PayoutRecord> {
  const agentAddress = agentWalletAddress(agentId);
  const amountStr = amount.toFixed(2);
  const x402 = getX402Adapter();

  console.log(JSON.stringify({
    level: "info",
    timestamp: new Date().toISOString(),
    message: "[payer] initiating winner payment",
    agentId,
    agentAddress,
    amount: amountStr,
    demoMode: DEMO_MODE,
  }));

  const result = await x402.payEndpoint(
    agentAddress,
    amountStr,
    `Bounty winner payment to ${agentId}`
  );

  const payout: PayoutRecord = {
    from: PAYMENT_FROM,
    to: agentAddress,
    amount: amountStr,
    asset: "USDC",
    network: "eip155:84532",
    txHash: result.txHash,
    demoMode: DEMO_MODE,
    settledAt: new Date().toISOString(),
  };

  console.log(JSON.stringify({
    level: "info",
    timestamp: new Date().toISOString(),
    message: "[payer] payment settled",
    agentId,
    txHash: result.txHash,
    settled: result.settled,
  }));

  return payout;
}
