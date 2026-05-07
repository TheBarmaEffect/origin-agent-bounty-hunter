import type { AgentSubmission, DefiProtocol, GreedyExecutionLog } from "@origin/shared";
import type { AgentRuntime } from "./types";

const DEMO_DISQUALIFY_AGENT = process.env.DEMO_DISQUALIFY_AGENT;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const TVL_THRESHOLD = 500_000_000; // $500M minimum TVL
const CRITICAL_RISK_FLAGS = new Set(["rug-pull", "exploit", "hack", "insecure"]);

export const dash: AgentRuntime = {
  agentId: "dash",
  algorithm: "Greedy",

  async run(
    bountyId: string,
    protocols: DefiProtocol[],
    _timeLimitMs: number,
    emitProgress: (step: string, detail: string, progress: number) => void
  ): Promise<AgentSubmission> {
    const startMs = Date.now();
    const reasoningTrace: string[] = [];

    emitProgress("Greedy sort by TVL", "Sorting all protocols by tvlUsd descending", 10);
    reasoningTrace.push("Greedy: sorting by TVL — pure single-pass selection, no backtracking");
    await delay(1000);

    // Sort by TVL (greedy: highest first, always pick best immediate option)
    const sorted = [...protocols].sort((a, b) => b.tvlUsd - a.tvlUsd);

    const decisions: GreedyExecutionLog["decisions"] = [];
    const selected: DefiProtocol[] = [];
    let backtrackCount = 0;
    let step = 0;

    for (const protocol of sorted) {
      if (selected.length >= 3) break;
      step++;

      // Greedy criterion: above TVL threshold and no critical risk flags
      const hasCriticalRisk = protocol.riskFlags.some((f) => CRITICAL_RISK_FLAGS.has(f));
      const aboveThreshold = protocol.tvlUsd >= TVL_THRESHOLD;
      const accepted = aboveThreshold && !hasCriticalRisk;

      const alternatives = sorted
        .filter((p) => p.name !== protocol.name && !selected.includes(p))
        .slice(0, 2)
        .map((p) => p.name);

      decisions.push({
        step,
        chosen: accepted ? protocol.name : `[SKIP] ${protocol.name}`,
        score: protocol.tvlUsd / 1e9,
        alternatives,
      });

      if (accepted) {
        selected.push(protocol);
        emitProgress(
          `Greedy pick #${selected.length}`,
          `Accepted: ${protocol.name} (TVL: $${(protocol.tvlUsd / 1e9).toFixed(1)}B)`,
          10 + selected.length * 25
        );
        reasoningTrace.push(
          `Pick ${selected.length}: ${protocol.name} — TVL $${(protocol.tvlUsd / 1e9).toFixed(2)}B, riskFlags: [${protocol.riskFlags.join(", ") || "none"}]`
        );
        await delay(1500);
      } else {
        reasoningTrace.push(
          `Skipped: ${protocol.name} — ${!aboveThreshold ? "TVL below threshold" : "critical risk flag"}`
        );
      }
    }

    // Demo disqualification: inject a backtrack
    if (DEMO_DISQUALIFY_AGENT === "dash") {
      backtrackCount = 1;
      decisions.push({
        step: step + 1,
        chosen: "[BACKTRACK] reconsidering previous choice",
        score: 0,
        alternatives: [],
      });
      reasoningTrace.push("[DEMO] Forcing backtrackCount=1 for disqualification demo");
    }

    emitProgress("Greedy selection complete", `Selected: ${selected.map((p) => p.name).join(", ")}`, 95);
    reasoningTrace.push(`Greedy complete: ${selected.length} protocols selected in ${step} decisions`);
    await delay(500);

    const submittedAtMs = Date.now() - startMs;

    const executionLog: GreedyExecutionLog = {
      agentId: "dash",
      algorithm: "Greedy",
      decisions,
      backtrackCount,
      submittedAtMs,
    };

    const submission: AgentSubmission = {
      bountyId,
      agentId: "dash",
      algorithm: "Greedy",
      answer: {
        topProtocols: selected.map((p, i) => ({
          rank: i + 1,
          name: p.name,
          chain: p.chain,
          tvlUsd: p.tvlUsd,
          volume24hUsd: p.volume24hUsd,
          riskAdjustedScore: parseFloat((p.tvlUsd / 1e9).toFixed(3)),
          recommendation: `Greedy selection: ${p.name} cleared TVL threshold ($${(TVL_THRESHOLD / 1e6).toFixed(0)}M) with no critical risk flags. Immediate best pick at step ${i + 1}.`,
        })),
        summary: `Dash completed greedy selection in ${submittedAtMs}ms — the fastest of all agents. Single-pass TVL sort with threshold filtering (≥$${(TVL_THRESHOLD / 1e9).toFixed(1)}B TVL, no critical risk flags). ${backtrackCount} backtracks (should be 0). Selected ${selected.length} protocols across ${step} decisions.`,
        methodology: `Greedy algorithm: sort by tvlUsd DESC, iterate once, accept if tvlUsd ≥ $${TVL_THRESHOLD.toLocaleString()} AND no critical risk flags (${[...CRITICAL_RISK_FLAGS].join(", ")}). No backtracking. First-acceptable heuristic. Time complexity: O(n log n) sort + O(n) scan.`,
        confidence: 0.71,
      },
      reasoningTrace,
      executionLog,
      status: "submitted",
      submittedAtMs,
      disqualified: false,
    };

    return submission;
  },
};
