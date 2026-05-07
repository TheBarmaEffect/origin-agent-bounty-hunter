import type { AgentSubmission, DefiProtocol, DFSExecutionLog } from "@origin/shared";
import type { AgentRuntime } from "./types";

const MIN_DFS_DEPTH = 4;
// In demo mode, default to disqualifying drill so the audience always sees the
// constraint-violation moment. Override with DEMO_DISQUALIFY_AGENT="" to disable.
const DEMO_MODE = process.env.DEMO_MODE !== "false";
const DEMO_DISQUALIFY_AGENT =
  process.env.DEMO_DISQUALIFY_AGENT !== undefined
    ? process.env.DEMO_DISQUALIFY_AGENT
    : (DEMO_MODE ? "drill" : "");

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const drill: AgentRuntime = {
  agentId: "drill",
  algorithm: "DFS",

  async run(
    bountyId: string,
    protocols: DefiProtocol[],
    _timeLimitMs: number,
    emitProgress: (step: string, detail: string, progress: number) => void
  ): Promise<AgentSubmission> {
    const startMs = Date.now();
    const reasoningTrace: string[] = [];

    emitProgress("Initializing DFS stack...", "Sorting protocols by TVL for root selection", 5);
    reasoningTrace.push("DFS initialization: selecting highest-TVL root node");
    await delay(3000);

    // Sort by TVL descending; start DFS from highest TVL
    const sorted = [...protocols].sort((a, b) => b.tvlUsd - a.tvlUsd);
    const root = sorted[0];

    emitProgress("Root node selected", `Starting from ${root.name} (TVL: $${root.tvlUsd.toLocaleString()})`, 12);
    reasoningTrace.push(`Root: ${root.name} — highest TVL anchor for depth-first exploration`);
    await delay(2000);

    // DFS exploration — group by category as "neighbors"
    const categoryGroups: Record<string, DefiProtocol[]> = {};
    for (const p of protocols) {
      if (!categoryGroups[p.category]) categoryGroups[p.category] = [];
      categoryGroups[p.category].push(p);
    }

    const stack: string[] = [root.name];
    const committedPath: string[] = [];
    const stackSnapshots: string[][] = [];
    const backtrackEvents: { from: string; to: string; reason: string }[] = [];
    const visited = new Set<string>();
    let maxDepthReached = 0;

    stackSnapshots.push([...stack]);

    // DFS loop: push neighbors of current, pop to go deep
    let depth = 0;
    let current = root;

    for (let iter = 0; iter < 8 && depth < 6; iter++) {
      visited.add(current.name);
      committedPath.push(current.name);
      depth++;

      if (depth > maxDepthReached) maxDepthReached = depth;

      emitProgress(
        `DFS depth ${depth}`,
        `Exploring: ${current.name} | Category: ${current.category}`,
        12 + iter * 10
      );
      reasoningTrace.push(
        `[depth=${depth}] Committed to ${current.name} (${current.category}, TVL: $${current.tvlUsd.toLocaleString()})`
      );
      await delay(4000);

      // Find neighbors: same category or adjacent TVL tier
      const neighbors = categoryGroups[current.category]?.filter(
        (p) => !visited.has(p.name) && p.name !== current.name
      ) ?? [];

      if (neighbors.length > 0) {
        // Push all neighbors onto stack, then pop the top (DFS)
        for (const n of neighbors.slice(0, 2)) {
          if (!stack.includes(n.name)) stack.push(n.name);
        }
        stackSnapshots.push([...stack]);
        current = neighbors[0];
      } else {
        // Go to next item on the stack (explore different branch)
        const next = sorted.find(
          (p) => !visited.has(p.name) && !committedPath.includes(p.name)
        );
        if (next) {
          backtrackEvents.push({
            from: current.name,
            to: next.name,
            reason: "No unvisited neighbors — exploring next TVL-sorted candidate",
          });
          stackSnapshots.push([...stack]);
          current = next;
        } else {
          break;
        }
      }
    }

    // Check for disqualification override
    if (DEMO_DISQUALIFY_AGENT === "drill") {
      maxDepthReached = 2; // Below minimum of 3 — triggers audit failure
      reasoningTrace.push("[DEMO] Forcing maxDepthReached=2 for disqualification demo");
    }

    emitProgress("DFS complete — committed path finalized", `Path: ${committedPath.join(" → ")}`, 88);
    reasoningTrace.push(`DFS committed path (length ${committedPath.length}): ${committedPath.join(" → ")}`);
    await delay(3000);

    // Pick top 3 from committed path by TVL
    const pathProtocols = committedPath
      .map((name) => protocols.find((p) => p.name === name))
      .filter((p): p is DefiProtocol => p !== undefined)
      .sort((a, b) => b.tvlUsd - a.tvlUsd);

    const top3 = pathProtocols.slice(0, 3);
    const submittedAtMs = Date.now() - startMs;

    const executionLog: DFSExecutionLog = {
      agentId: "drill",
      algorithm: "DFS",
      stackSnapshots,
      committedPath,
      backtrackEvents,
      maxDepthReached,
      minDfsDepth: MIN_DFS_DEPTH,
    };

    const submission: AgentSubmission = {
      bountyId,
      agentId: "drill",
      algorithm: "DFS",
      answer: {
        topProtocols: top3.map((p, i) => ({
          rank: i + 1,
          name: p.name,
          chain: p.chain,
          tvlUsd: p.tvlUsd,
          volume24hUsd: p.volume24hUsd,
          riskAdjustedScore: parseFloat(
            (p.tvlUsd / 1e9 - p.riskFlags.length * 0.5).toFixed(2)
          ),
          recommendation: `Deep DFS analysis of ${p.name} confirmed strong fundamentals within the ${p.category} category. Path depth ${maxDepthReached} reached.`,
        })),
        summary: `Drill executed a depth-first search starting from the highest-TVL protocol. The DFS algorithm committed to a path of depth ${maxDepthReached}, exploring ${committedPath.length} protocols in sequence. ${backtrackEvents.length} branch switches were recorded.`,
        methodology: `DFS from root=${root.name}. Neighbors grouped by protocol category. Stack-based exploration, committing to deepest path before backtracking. Max depth target: ${MIN_DFS_DEPTH}, achieved: ${maxDepthReached}.`,
        confidence: 0.69,
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
