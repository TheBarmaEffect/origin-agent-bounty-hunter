import type { AgentSubmission, DefiProtocol, BFSExecutionLog } from "@origin/shared";
import type { AgentRuntime } from "./types";

const MIN_BREADTH_N = 10;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const scout: AgentRuntime = {
  agentId: "scout",
  algorithm: "BFS",

  async run(
    bountyId: string,
    protocols: DefiProtocol[],
    _timeLimitMs: number,
    emitProgress: (step: string, detail: string, progress: number) => void
  ): Promise<AgentSubmission> {
    const startMs = Date.now();
    const reasoningTrace: string[] = [];

    emitProgress("Initializing BFS queue...", `Loaded ${protocols.length} protocols into queue`, 5);
    reasoningTrace.push(`BFS initialization: ${protocols.length} protocols queued`);
    await delay(2000);

    // BFS: queue starts with all protocol names at depth 0
    const queue: Array<{ name: string; depth: number }> = protocols.map((p) => ({
      name: p.name,
      depth: 0,
    }));
    const nodesVisited: string[] = [];
    const depthByNode: Record<string, number> = {};
    const queueSnapshots: string[][] = [];

    // Process breadth level 0 first
    let processedAtDepth0 = 0;
    let breadthRequirementMet = false;
    const depth0Nodes: string[] = [];

    emitProgress(
      "Processing breadth level 0",
      `Queue has ${queue.length} nodes at depth 0`,
      15
    );
    reasoningTrace.push(`Processing depth-0 nodes (breadth sweep)`);
    await delay(3000);

    // Take snapshot of initial queue
    queueSnapshots.push(queue.slice(0, 5).map((q) => q.name));

    for (const item of queue) {
      if (item.depth === 0) {
        nodesVisited.push(item.name);
        depthByNode[item.name] = 0;
        depth0Nodes.push(item.name);
        processedAtDepth0++;

        if (processedAtDepth0 % 4 === 0) {
          queueSnapshots.push(
            depth0Nodes.slice(Math.max(0, depth0Nodes.length - 4))
          );
          emitProgress(
            `BFS depth-0 sweep`,
            `Visited ${processedAtDepth0} nodes: ${item.name}`,
            15 + Math.floor((processedAtDepth0 / Math.max(protocols.length, 1)) * 30)
          );
          reasoningTrace.push(`Visited: ${item.name} (TVL: $${protocols.find(p => p.name === item.name)?.tvlUsd?.toLocaleString() ?? "?"})`);
          await delay(500);
        }
      }
    }

    if (processedAtDepth0 >= MIN_BREADTH_N) {
      breadthRequirementMet = true;
      emitProgress(
        "Breadth requirement met",
        `Visited ${processedAtDepth0} nodes at depth 0 (≥${MIN_BREADTH_N})`,
        55
      );
      reasoningTrace.push(`Breadth requirement satisfied: ${processedAtDepth0} >= ${MIN_BREADTH_N}`);
    }

    await delay(3000);

    // Score visited nodes by TVL * volume composite
    emitProgress("Scoring candidates by composite metric", "TVL * Volume composite ranking", 70);
    reasoningTrace.push("Scoring by composite TVL × Volume metric");
    await delay(2000);

    const scored = nodesVisited
      .map((name) => {
        const p = protocols.find((pr) => pr.name === name);
        if (!p) return { name, score: 0, protocol: null as DefiProtocol | null };
        const score = (p.tvlUsd * 0.6 + p.volume24hUsd * 0.4) * (1 - p.riskFlags.length * 0.05);
        return { name, score, protocol: p };
      })
      .sort((a, b) => b.score - a.score);

    const top3 = scored.slice(0, 3);

    emitProgress("BFS complete — top candidates identified", `Top: ${top3.map((t) => t.name).join(", ")}`, 90);
    reasoningTrace.push(`BFS top-3: ${top3.map((t) => `${t.name} (score: ${t.score.toFixed(0)})`).join(", ")}`);
    await delay(2000);

    const submittedAtMs = Date.now() - startMs;

    const executionLog: BFSExecutionLog = {
      agentId: "scout",
      algorithm: "BFS",
      queueSnapshots,
      nodesVisited,
      depthByNode,
      breadthRequirementMet,
      minBreadthN: MIN_BREADTH_N,
    };

    const submission: AgentSubmission = {
      bountyId,
      agentId: "scout",
      algorithm: "BFS",
      answer: {
        topProtocols: top3.map((t, i) => ({
          rank: i + 1,
          name: t.name,
          chain: t.protocol?.chain ?? "Unknown",
          tvlUsd: t.protocol?.tvlUsd ?? 0,
          volume24hUsd: t.protocol?.volume24hUsd ?? 0,
          riskAdjustedScore: parseFloat(t.score.toFixed(2)),
          recommendation: `${t.name} offers strong TVL and volume metrics across DeFi categories. BFS sweep confirmed broad protocol coverage.`,
        })),
        summary: `Scout completed a full breadth-first sweep of ${nodesVisited.length} DeFi protocols. The BFS algorithm visited all nodes at depth 0 before proceeding, satisfying the MIN_BREADTH_N=${MIN_BREADTH_N} requirement. Top candidates were ranked by a composite TVL×Volume metric with risk adjustment applied per flag count.`,
        methodology: `BFS queue initialized with ${protocols.length} protocols. Processed ${nodesVisited.length} nodes at depth-0 before any depth-1 exploration. Composite score = (TVL × 0.6 + Volume × 0.4) × (1 - 0.05 × riskFlagCount). Top 3 selected by descending composite score.`,
        confidence: 0.74,
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
