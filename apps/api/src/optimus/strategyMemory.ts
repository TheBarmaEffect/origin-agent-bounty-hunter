import type { AgentId, ProblemType, StrategyStats, Verdict } from "@origin/shared";
import { storage } from "../storage";

const ALL_AGENTS: AgentId[] = ["scout", "drill", "compass", "dice", "dash"];

export async function updateStrategyMemory(verdict: Verdict): Promise<StrategyStats[]> {
  const problemType = verdict.problemType;
  const winnerAgentId = verdict.actualWinnerAgentId;
  const now = new Date().toISOString();

  const updated: StrategyStats[] = [];

  for (const agentId of ALL_AGENTS) {
    // Load existing stats or create fresh
    const existing = await getOrCreateStats(agentId, problemType);

    const agentSummary = verdict.agentSummaries.find((s) => s.agentId === agentId);
    const submission = verdict.submissions.find((s) => s.agentId === agentId);
    const agentScore = submission?.scoreBreakdown?.total ?? 0;

    existing.totalRaces += 1;

    if (agentSummary?.disqualified) {
      existing.disqualifications += 1;
    } else if (agentId === winnerAgentId) {
      existing.wins += 1;
    } else {
      existing.losses += 1;
    }

    // Update rolling average score
    existing.averageScore =
      (existing.averageScore * (existing.totalRaces - 1) + agentScore) / existing.totalRaces;

    existing.lastUpdatedAt = now;

    await storage.saveStrategyStats(existing);
    updated.push(existing);
  }

  return updated;
}

export async function getAllStats(): Promise<StrategyStats[]> {
  return storage.getAllStrategyStats();
}

async function getOrCreateStats(agentId: AgentId, problemType: ProblemType): Promise<StrategyStats> {
  const all = await storage.getAllStrategyStats();
  const found = all.find((s) => s.agentId === agentId && s.problemType === problemType);
  if (found) return { ...found };

  return {
    agentId,
    problemType,
    wins: 0,
    losses: 0,
    disqualifications: 0,
    totalRaces: 0,
    averageScore: 0,
    lastUpdatedAt: new Date().toISOString(),
  };
}
