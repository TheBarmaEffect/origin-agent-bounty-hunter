import type { AgentSubmission, AgentId, ScoreBreakdown } from "@origin/shared";

export function selectWinner(
  submissions: AgentSubmission[],
  scores: Map<AgentId, ScoreBreakdown>
): AgentId {
  // Filter out disqualified submissions
  const eligible = submissions.filter((s) => !s.disqualified);

  if (eligible.length === 0) {
    // All disqualified — pick the one with the highest score anyway
    const sorted = [...submissions].sort((a, b) => {
      const scoreA = scores.get(a.agentId)?.total ?? 0;
      const scoreB = scores.get(b.agentId)?.total ?? 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return a.submittedAtMs - b.submittedAtMs; // Tiebreak: earlier submission wins
    });
    return sorted[0].agentId;
  }

  // Sort eligible by total score descending; tiebreak by earlier submittedAtMs
  const sorted = [...eligible].sort((a, b) => {
    const scoreA = scores.get(a.agentId)?.total ?? 0;
    const scoreB = scores.get(b.agentId)?.total ?? 0;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return a.submittedAtMs - b.submittedAtMs;
  });

  return sorted[0].agentId;
}
