import { createHash } from "crypto";
import type { AgentSubmission, DefiProtocol, AStarExecutionLog } from "@origin/shared";
import type { AgentRuntime } from "./types";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ScoredNode {
  name: string;
  g: number;
  h: number;
  f: number;
}

export const compass: AgentRuntime = {
  agentId: "compass",
  algorithm: "A*",

  async run(
    bountyId: string,
    protocols: DefiProtocol[],
    _timeLimitMs: number,
    emitProgress: (step: string, detail: string, progress: number) => void
  ): Promise<AgentSubmission> {
    const startMs = Date.now();
    const reasoningTrace: string[] = [];

    // STEP 1: Declare heuristic FIRST (before any scoring)
    const declaredHeuristicAt = new Date().toISOString();
    const heuristicDesc =
      "f(n) = g(n) + h(n); h(n) = (tvl/maxTvl)*0.4 + (vol/maxVol)*0.3 + (momentum*0.01)*0.2 - (riskCount*0.1); g(n) = 0 (single-pass)";
    const heuristicVersion = createHash("sha256")
      .update(heuristicDesc + declaredHeuristicAt)
      .digest("hex")
      .slice(0, 16);

    emitProgress("Declaring A* heuristic", heuristicDesc, 5);
    reasoningTrace.push(`[HEURISTIC DECLARED] version=${heuristicVersion}`);
    reasoningTrace.push(`Formula: ${heuristicDesc}`);
    await delay(2000);

    emitProgress("Initializing open set", `Loaded ${protocols.length} candidate nodes`, 12);
    reasoningTrace.push(`Open set initialized with ${protocols.length} protocols`);
    await delay(1500);

    // Compute max values for normalization
    const maxTvl = Math.max(...protocols.map((p) => p.tvlUsd));
    const maxVol = Math.max(...protocols.map((p) => p.volume24hUsd));

    const scoreBreakdowns: AStarExecutionLog["scoreBreakdowns"] = {};
    const openSet: ScoredNode[] = [];
    const closedSet: string[] = [];
    const openSetSnapshots: AStarExecutionLog["openSetSnapshots"] = [];

    // Initialize open set with h-scores for all nodes
    for (const p of protocols) {
      const tvlScore = (p.tvlUsd / maxTvl) * 0.4;
      const volumeScore = (p.volume24hUsd / maxVol) * 0.3;
      const momentumScore = (Math.max(0, p.change24hPct) * 0.01) * 0.2;
      const riskScore = p.riskFlags.length * 0.1;
      const h = tvlScore + volumeScore + momentumScore - riskScore;
      const g = 0;
      const f = g + h;

      scoreBreakdowns[p.name] = {
        tvlScore: parseFloat(tvlScore.toFixed(4)),
        volumeScore: parseFloat(volumeScore.toFixed(4)),
        momentumScore: parseFloat(momentumScore.toFixed(4)),
        riskScore: parseFloat(riskScore.toFixed(4)),
        total: parseFloat(f.toFixed(4)),
      };

      openSet.push({ name: p.name, g, h, f });
    }

    // Sort open set by f-score descending (best first)
    openSet.sort((a, b) => b.f - a.f);
    openSetSnapshots.push(openSet.slice(0, 5).map((n) => ({ ...n })));

    emitProgress("A* open set scored", `Top node: ${openSet[0].name} (f=${openSet[0].f.toFixed(4)})`, 30);
    reasoningTrace.push(`A* scored all protocols. Top: ${openSet.slice(0, 3).map((n) => `${n.name}(f=${n.f.toFixed(3)})`).join(", ")}`);
    await delay(3000);

    // Extract best candidates from open set iteratively
    let extracted = 0;
    while (openSet.length > 0 && extracted < protocols.length) {
      const best = openSet.shift()!;
      closedSet.push(best.name);
      extracted++;

      if (extracted <= 5) {
        emitProgress(
          `A* extracting node ${extracted}`,
          `${best.name}: f=${best.f.toFixed(4)} (tvl=${scoreBreakdowns[best.name].tvlScore.toFixed(3)}, vol=${scoreBreakdowns[best.name].volumeScore.toFixed(3)})`,
          30 + extracted * 8
        );
        reasoningTrace.push(
          `Extracted: ${best.name} f=${best.f.toFixed(4)} — tvl=${scoreBreakdowns[best.name].tvlScore.toFixed(3)}, vol=${scoreBreakdowns[best.name].volumeScore.toFixed(3)}, risk=-${scoreBreakdowns[best.name].riskScore.toFixed(3)}`
        );
        await delay(3000);
      }

      if (extracted === 3) {
        openSetSnapshots.push(openSet.slice(0, 5).map((n) => ({ ...n })));
      }
    }

    emitProgress("A* search complete", `Evaluated ${closedSet.length} protocols, closed set finalized`, 88);
    reasoningTrace.push(`A* complete: closed set = ${closedSet.length} protocols`);
    await delay(2000);

    // Top 3 from closed set (they're already sorted by f-score)
    const top3Names = closedSet.slice(0, 3);
    const top3 = top3Names.map((name) => protocols.find((p) => p.name === name)!);

    const submittedAtMs = Date.now() - startMs;

    const executionLog: AStarExecutionLog = {
      agentId: "compass",
      algorithm: "A*",
      declaredHeuristicAt,
      heuristicVersion,
      openSetSnapshots,
      closedSet,
      scoreBreakdowns,
    };

    const submission: AgentSubmission = {
      bountyId,
      agentId: "compass",
      algorithm: "A*",
      answer: {
        topProtocols: top3.map((p, i) => {
          const breakdown = scoreBreakdowns[p.name];
          return {
            rank: i + 1,
            name: p.name,
            chain: p.chain,
            tvlUsd: p.tvlUsd,
            volume24hUsd: p.volume24hUsd,
            riskAdjustedScore: parseFloat(breakdown.total.toFixed(4)),
            recommendation: `A* heuristic ranked ${p.name} #${i + 1} with composite score ${breakdown.total.toFixed(3)}. TVL contribution: ${breakdown.tvlScore.toFixed(3)}, Volume: ${breakdown.volumeScore.toFixed(3)}, Risk penalty: -${breakdown.riskScore.toFixed(3)}.`,
          };
        }),
        summary: `Compass executed A* heuristic search across ${protocols.length} DeFi protocols. Heuristic version ${heuristicVersion} was declared before scoring to ensure algorithm integrity. The composite f(n) function weights TVL (40%), volume (30%), momentum (20%), and risk-adjusts by -10% per risk flag. All ${closedSet.length} protocols were evaluated and ranked.`,
        methodology: `A* search: heuristic declared at ${declaredHeuristicAt} (version ${heuristicVersion}). Open set initialized with ${protocols.length} candidates. Normalized scoring: tvl/maxTvl*0.4 + vol/maxVol*0.3 + momentum*0.2 - riskFlags*0.1. Candidates extracted by f-score; top 3 represent optimal risk-adjusted DeFi protocols.`,
        confidence: 0.89,
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
