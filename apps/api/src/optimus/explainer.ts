import type { AgentId, AgentSubmission, BountyClassification, ScoreBreakdown } from "@origin/shared";

const BEDROCK_REGION = process.env.BEDROCK_REGION;
const BEDROCK_MODEL = process.env.BEDROCK_MODEL || "anthropic.claude-sonnet-4-5-v1:0";

export async function generateExplanation(
  winner: AgentId,
  submissions: AgentSubmission[],
  scores: Map<AgentId, ScoreBreakdown>,
  classification: BountyClassification
): Promise<string> {
  // Try Bedrock first if configured
  if (BEDROCK_REGION && process.env.AWS_ACCESS_KEY_ID) {
    try {
      const llm = await callBedrock(winner, submissions, scores, classification);
      if (llm) {
        console.log(JSON.stringify({
          level: "info", timestamp: new Date().toISOString(),
          message: "[explainer] verdict generated via Bedrock", model: BEDROCK_MODEL,
        }));
        return llm;
      }
    } catch (err) {
      console.warn("[explainer] Bedrock call failed, falling back to template:", (err as Error).message);
    }
  }
  return template(winner, submissions, scores, classification);
}

async function callBedrock(
  winner: AgentId,
  submissions: AgentSubmission[],
  scores: Map<AgentId, ScoreBreakdown>,
  classification: BountyClassification,
): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { BedrockRuntimeClient, InvokeModelCommand }: any = await import("@aws-sdk/client-bedrock-runtime" as string as never);
  const client = new BedrockRuntimeClient({ region: BEDROCK_REGION });

  const summary = submissions.map((s) => {
    const sc = scores.get(s.agentId);
    return {
      agentId: s.agentId,
      algorithm: s.algorithm,
      score: sc?.total ?? 0,
      disqualified: !!s.disqualified,
      disqualificationReason: s.disqualificationReason,
      submittedAtMs: s.submittedAtMs,
    };
  });

  const userMsg = [
    `You are Optimus, an objective judge in an autonomous AI agent competition.`,
    `Five algorithm-bound agents competed: Scout (BFS), Drill (DFS), Compass (A*), Dice (Monte Carlo), Dash (Greedy).`,
    `Bounty classified as: ${classification.problemType} (predicted winner: ${classification.expectedWinnerAgentId}, confidence ${(classification.confidence * 100).toFixed(0)}%).`,
    `Final results: ${JSON.stringify(summary)}`,
    `Actual winner: ${winner}`,
    ``,
    `Write a concise 2-3 sentence verdict explaining why ${winner} won. ` +
    `Mention specific scores, algorithm-relevant strengths, and at least one notable competitor. ` +
    `If your prediction (${classification.expectedWinnerAgentId}) was wrong, acknowledge that and explain what you missed. ` +
    `No filler, no hedging.`,
  ].join("\n");

  const body = JSON.stringify({
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 320,
    messages: [{ role: "user", content: userMsg }],
  });

  const resp = await client.send(new InvokeModelCommand({
    modelId: BEDROCK_MODEL,
    body, contentType: "application/json", accept: "application/json",
  }));

  const decoded = JSON.parse(new TextDecoder().decode(resp.body));
  const text: string = decoded?.content?.[0]?.text?.trim();
  return text || null;
}

function template(
  winner: AgentId,
  submissions: AgentSubmission[],
  scores: Map<AgentId, ScoreBreakdown>,
  classification: BountyClassification,
): string {
  const winnerScore = scores.get(winner)?.total ?? 0;
  const expectedAgent = classification.expectedWinnerAgentId;
  const predictionCorrect = winner === expectedAgent;
  const confidence = classification.confidence;

  const scoutSub = submissions.find((s) => s.agentId === "scout");
  const scoutLog = scoutSub?.executionLog as { nodesVisited?: string[] } | undefined;
  const scoutCount = scoutLog?.nodesVisited?.length ?? 0;

  const dashSub = submissions.find((s) => s.agentId === "dash");
  const dashMs = dashSub?.submittedAtMs ?? 0;

  const algoMap: Record<AgentId, string> = {
    compass: "A* heuristic search", scout: "BFS breadth-first search",
    drill: "DFS depth-first search", dice: "Monte Carlo sampling", dash: "Greedy selection",
  };
  const taskDesc: Record<string, string> = {
    "heuristic-structured": "heuristic-structured discovery task",
    "breadth-discovery": "breadth-first discovery task",
    "depth-investigation": "deep-dive investigation task",
    "probabilistic-search": "probabilistic sampling task",
    "speed-critical": "time-critical selection task",
    hybrid: "hybrid analysis task",
  };

  const algorithm = algoMap[winner] ?? winner;
  const task = taskDesc[classification.problemType] ?? classification.problemType;

  let explanation =
    `${cap(winner)} won this ${task} with a score of ${winnerScore.toFixed(1)}/100. ` +
    `Its ${algorithm} produced the strongest combination of constraint compliance, evidence quality, and methodology fit.`;

  if (scoutCount > 0 && winner !== "scout") {
    explanation += ` Scout covered ${scoutCount} candidates but lacked the ranking heuristic depth.`;
  }
  if (dashMs > 0 && winner !== "dash") {
    const dashScore = scores.get("dash");
    const disqualified = submissions.find((s) => s.agentId === "dash")?.disqualified;
    if (!disqualified && dashScore) {
      explanation += ` Dash submitted in ${(dashMs / 1000).toFixed(1)}s (score ${dashScore.total.toFixed(1)}/100) but missed the top candidate due to greedy local bias.`;
    } else if (disqualified) {
      explanation += ` Dash submitted at ${(dashMs / 1000).toFixed(1)}s but was disqualified for constraint violations.`;
    }
  }
  explanation +=
    ` Optimus predicted ${cap(expectedAgent)} (confidence ${(confidence * 100).toFixed(0)}%) — ` +
    (predictionCorrect ? "correct." : `but ${cap(winner)} outperformed via algorithm fit the classifier underweighted.`);

  return explanation;
}

function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }
