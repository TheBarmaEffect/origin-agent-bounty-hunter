import { v4 as uuidv4 } from "uuid";
import type {
  AgentId,
  AgentSubmission,
  BountyClassification,
  DefiProtocol,
  SSEEvent,
  ScoreBreakdown,
  Verdict,
} from "@origin/shared";
import { storage } from "../storage";
import { raceStream } from "../sse/raceStream";
import { getDefiProtocols } from "../data/defiData";
import { classifyBounty } from "../optimus/classifier";
import { auditAgent } from "../optimus/auditor";
import type { AuditResult } from "../optimus/auditor";
import { scoreSubmission } from "../optimus/scorer";
import { selectWinner } from "../optimus/judger";
import { generateExplanation } from "../optimus/explainer";
import { payWinner } from "../optimus/payer";
import { publishVerdict } from "../proof/chainPublisher";
import { hashVerdict } from "../proof/verdictHasher";
import { updateStrategyMemory } from "../optimus/strategyMemory";
import { scout } from "../agents/scout";
import { drill } from "../agents/drill";
import { compass } from "../agents/compass";
import { dice } from "../agents/dice";
import { dash } from "../agents/dash";

const ALL_AGENTS = [scout, drill, compass, dice, dash];
const DEMO_MODE = process.env.DEMO_MODE !== "false";

function makeEvent<T extends SSEEvent>(
  bountyId: string,
  type: T["type"],
  payload: T extends { payload: infer P } ? P : never
): T {
  return {
    id: uuidv4(),
    bountyId,
    type,
    timestamp: new Date().toISOString(),
    payload,
  } as unknown as T;
}

function emit(bountyId: string, event: SSEEvent): void {
  raceStream.emit(bountyId, event);
}

export async function runRace(bountyId: string): Promise<void> {
  const raceStart = Date.now();

  // 1. Load bounty
  const bounty = await storage.getBounty(bountyId);
  if (!bounty) throw new Error(`Bounty ${bountyId} not found`);

  const timeLimitMs = bounty.timeLimitSeconds * 1000;

  // 1b. REAL bounty fund — user wallet → Origin escrow on Base Sepolia
  // Self-pay since we have one funded test wallet; the on-chain log is real.
  try {
    const { sendUsdc } = await import("../payments/cdpPayer");
    const escrow = process.env.AGENT_WALLET_ADDRESS || "0x0000000000000000000000000000000000000001";
    const fund = await sendUsdc({
      to: escrow,
      amountUsdc: bounty.budgetUsdc,
      purpose: `Fund bounty ${bountyId}`,
    });
    emit(bountyId, makeEvent(bountyId, "payment.started" as any, {
      from: process.env.AGENT_WALLET_ADDRESS,
      to: escrow,
      amount: bounty.budgetUsdc.toFixed(2),
      asset: "USDC",
      txHash: fund.txHash,
      isHero: true,
      real: fund.real,
      purpose: "bounty_fund",
      demoMode: !fund.real,
    }));
  } catch (err) {
    console.warn("[raceEngine] bounty fund tx failed:", (err as Error).message);
  }

  await delay(300);

  // 2. Fetch DeFi data for agents
  const protocols: DefiProtocol[] = await getDefiProtocols(bountyId);

  // 3. Optimus classifying
  emit(bountyId, makeEvent(bountyId, "optimus.classifying", {
    message: "Optimus is analyzing the bounty description to classify the problem type...",
  }));

  await delay(800);

  // 4. Classify
  const classification: BountyClassification = classifyBounty(bounty);

  emit(bountyId, makeEvent(bountyId, "optimus.classified", classification));

  await delay(400);

  // 5. Dispatch
  const agentIds: AgentId[] = ALL_AGENTS.map((a) => a.agentId);
  emit(bountyId, makeEvent(bountyId, "bounty.dispatched", { agentIds }));

  await delay(200);

  // 6. Queue all agents — and fire a real per-agent x402 payment event for each.
  // Each agent "pays" the data seller $0.001 USDC. With REAL_PAYMENTS=true these
  // are actual on-chain Base Sepolia txs.
  for (const agent of ALL_AGENTS) {
    emit(bountyId, makeEvent(bountyId, "agent.queued", {
      agentId: agent.agentId,
      algorithm: agent.algorithm,
    }));

    // Async — don't block the race start
    (async () => {
      try {
        const { sendUsdc } = await import("../payments/cdpPayer");
        const seller = process.env.X402_SELLER_WALLET || process.env.AGENT_WALLET_ADDRESS!;
        emit(bountyId, makeEvent(bountyId, "agent.payment" as any, {
          agentId: agent.agentId,
          endpoint: "/data/defi-protocols",
          amount: 0.001,
          status: "signing",
        }));
        const r = await sendUsdc({
          to: seller,
          amountUsdc: 0.001,
          purpose: `${agent.agentId} x402 data fetch`,
        });
        emit(bountyId, makeEvent(bountyId, "agent.payment" as any, {
          agentId: agent.agentId,
          endpoint: "/data/defi-protocols",
          amount: 0.001,
          status: "verified",
          txHash: r.txHash,
          real: r.real,
        }));
      } catch (err) {
        emit(bountyId, makeEvent(bountyId, "agent.payment" as any, {
          agentId: agent.agentId,
          endpoint: "/data/defi-protocols",
          amount: 0.001,
          status: "failed",
        }));
      }
    })();

    await delay(100);
  }

  // 7. Run all 5 agents concurrently
  const agentRunners = ALL_AGENTS.map((agent) => runAgentWithEvents(
    agent.agentId,
    bountyId,
    protocols,
    timeLimitMs,
    (step, detail, progress) => {
      emit(bountyId, makeEvent(bountyId, "agent.progress", {
        agentId: agent.agentId,
        step,
        detail,
        progress,
      }));
    },
    agent
  ));

  const results = await Promise.allSettled(agentRunners);

  // Collect submissions
  const submissions: AgentSubmission[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      submissions.push(result.value);
      await storage.saveSubmission(result.value);
    } else {
      console.error("[raceEngine] agent run failed", result.reason);
    }
  }

  // 8. Audit all agents
  const auditResults: Map<AgentId, AuditResult> = new Map();

  for (const submission of submissions) {
    emit(bountyId, makeEvent(bountyId, "agent.audit_started", {
      agentId: submission.agentId,
    }));
    await delay(300);

    const auditResult = auditAgent(submission);
    auditResults.set(submission.agentId, auditResult);

    if (auditResult.disqualificationReason) {
      submission.disqualified = true;
      submission.disqualificationReason = auditResult.disqualificationReason;
      submission.status = "disqualified";

      emit(bountyId, makeEvent(bountyId, "agent.audit_failed", {
        agentId: submission.agentId,
        checks: auditResult.checks,
        reason: auditResult.disqualificationReason,
      }));
    } else {
      submission.status = auditResult.passed ? "scored" : "audit_failed";
      submission.auditChecks = auditResult.checks;

      emit(bountyId, makeEvent(bountyId, "agent.audit_passed", {
        agentId: submission.agentId,
        checks: auditResult.checks,
      }));
    }

    await storage.saveSubmission(submission);
    await delay(400);
  }

  // 9. Score non-disqualified agents
  const scores: Map<AgentId, ScoreBreakdown> = new Map();

  for (const submission of submissions) {
    const auditResult = auditResults.get(submission.agentId)!;
    const score = scoreSubmission(submission, auditResult, classification, protocols);
    submission.scoreBreakdown = score;
    scores.set(submission.agentId, score);

    emit(bountyId, makeEvent(bountyId, "agent.scored", {
      agentId: submission.agentId,
      scoreBreakdown: score,
    }));

    await storage.saveSubmission(submission);
    await delay(200);
  }

  // 10. Judging
  emit(bountyId, makeEvent(bountyId, "optimus.judging", {
    message: "Optimus is selecting the winner based on audit results and scores...",
  }));
  await delay(1000);

  // 11. Select winner and generate rationale
  const winnerId = selectWinner(submissions, scores);
  const rationale = await generateExplanation(winnerId, submissions, scores, classification);

  const predictionCorrect = winnerId === classification.expectedWinnerAgentId;

  emit(bountyId, makeEvent(bountyId, "optimus.verdict", {
    winnerAgentId: winnerId,
    rationale,
    predictionCorrect,
    expectedAgentId: classification.expectedWinnerAgentId,
    problemType: classification.problemType,
  }));

  await delay(500);

  // 12. Payment
  const winnerScore = scores.get(winnerId)?.total ?? 0;

  // REAL winner payout — escrow → winner on Base Sepolia.
  // Self-pay since we have one funded wallet; tx is on-chain regardless.
  const winnerWallet = process.env.AGENT_WALLET_ADDRESS || "0x0000000000000000000000000000000000000001";
  emit(bountyId, makeEvent(bountyId, "payment.started" as any, {
    from: process.env.AGENT_WALLET_ADDRESS,
    to: winnerWallet,
    amount: bounty.budgetUsdc.toFixed(2),
    asset: "USDC",
    purpose: "winner_payout",
    agentId: winnerId,
  }));

  await delay(300);

  const { sendUsdc } = await import("../payments/cdpPayer");
  let payout;
  try {
    const r = await sendUsdc({
      to: winnerWallet,
      amountUsdc: bounty.budgetUsdc,
      purpose: `Winner payout to ${winnerId}`,
    });
    payout = {
      from: process.env.AGENT_WALLET_ADDRESS || "0x0",
      to: winnerWallet,
      amount: bounty.budgetUsdc.toFixed(2),
      asset: "USDC" as const,
      network: "eip155:84532" as const,
      txHash: r.txHash,
      demoMode: !r.real,
      settledAt: new Date().toISOString(),
    };
    emit(bountyId, makeEvent(bountyId, "payment.settled" as any, {
      txHash: r.txHash,
      amount: bounty.budgetUsdc.toFixed(2),
      agentId: winnerId,
      real: r.real,
      demoMode: !r.real,
    }));
  } catch (err) {
    console.warn("[raceEngine] winner payout failed, falling back to local:", (err as Error).message);
    payout = await payWinner(winnerId, bounty.budgetUsdc);
    emit(bountyId, makeEvent(bountyId, "payment.settled" as any, {
      txHash: payout.txHash ?? `demo-tx-${uuidv4()}`,
      amount: bounty.budgetUsdc.toFixed(2),
      agentId: winnerId,
      demoMode: DEMO_MODE,
    }));
  }

  await delay(300);

  // Build initial verdict (without hash/onchain) for hashing
  const agentSummaries = submissions.map((s) => ({
    agentId: s.agentId,
    score: scores.get(s.agentId)?.total ?? 0,
    disqualified: s.disqualified,
    disqualificationReason: s.disqualificationReason,
    auditChecks: s.auditChecks ?? auditResults.get(s.agentId)?.checks ?? [],
  }));

  const verdict: Verdict = {
    bountyId,
    problemType: classification.problemType,
    classification,
    actualWinnerAgentId: winnerId,
    optimusPredictionCorrect: predictionCorrect,
    rationale,
    agentSummaries,
    submissions,
    verdictHash: "", // filled below
    payout,
    createdAt: new Date().toISOString(),
  };

  // 13. Hash verdict
  const verdictHash = hashVerdict(verdict);
  verdict.verdictHash = verdictHash;

  emit(bountyId, makeEvent(bountyId, "proof.hash_created", { verdictHash }));
  await delay(300);

  // 14. Try chain publish
  try {
    const onchainTxHash = await publishVerdict(verdict, verdictHash);
    if (onchainTxHash) {
      verdict.onchainTxHash = onchainTxHash;
      emit(bountyId, makeEvent(bountyId, "proof.onchain_published", {
        txHash: onchainTxHash,
        network: "eip155:84532",
        contractAddress: process.env.VERDICT_CONTRACT_ADDRESS ?? "0x0",
      }));
    }
  } catch (err) {
    console.log("[raceEngine] chain publish skipped:", (err as Error).message);
  }

  await delay(300);

  // 15. Update strategy memory
  const updatedStats = await updateStrategyMemory(verdict);

  emit(bountyId, makeEvent(bountyId, "strategy_memory.updated", {
    stats: updatedStats,
  }));

  await delay(300);

  // 16. Mark bounty completed
  bounty.status = "paid";
  bounty.paymentStatus = "demo-paid";
  bounty.completedAt = new Date().toISOString();
  await storage.saveBounty(bounty);
  await storage.saveVerdict(verdict);

  emit(bountyId, makeEvent(bountyId, "bounty.completed", { verdict }));

  // 17. Save replay events
  const replayEvents = raceStream.getBuffer(bountyId);
  await storage.saveReplayEvents(bountyId, replayEvents);

  console.log(JSON.stringify({
    level: "info",
    timestamp: new Date().toISOString(),
    message: "[raceEngine] race complete",
    bountyId,
    winner: winnerId,
    durationMs: Date.now() - raceStart,
    winnerScore,
  }));
}

async function runAgentWithEvents(
  agentId: AgentId,
  bountyId: string,
  protocols: DefiProtocol[],
  timeLimitMs: number,
  emitProgressFn: (step: string, detail: string, progress: number) => void,
  agent: typeof ALL_AGENTS[number]
): Promise<AgentSubmission> {
  const startedAtMs = Date.now();

  emit(bountyId, makeEvent(bountyId, "agent.running", {
    agentId,
    startedAtMs,
  }));

  const submission = await agent.run(bountyId, protocols, timeLimitMs, emitProgressFn);

  emit(bountyId, makeEvent(bountyId, "agent.submitted", {
    agentId,
    submittedAtMs: submission.submittedAtMs,
    algorithmSummary: `${agent.algorithm} — ${submission.answer.topProtocols.slice(0, 2).map((p) => p.name).join(", ")}`,
  }));

  return submission;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
