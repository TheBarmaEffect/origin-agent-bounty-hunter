import type {
  AgentSubmission,
  BountyClassification,
  DefiProtocol,
  ScoreBreakdown,
  AgentId,
} from "@origin/shared";
import type { AuditResult } from "./auditor";

const ALGORITHM_ADJACENCY: Record<AgentId, AgentId[]> = {
  compass: ["scout", "dice"],
  scout: ["compass", "dice"],
  drill: ["compass"],
  dice: ["scout", "compass"],
  dash: ["dice"],
};

export function scoreSubmission(
  submission: AgentSubmission,
  auditResult: AuditResult,
  classification: BountyClassification,
  allProtocols: DefiProtocol[]
): ScoreBreakdown {
  // 1. Constraint Compliance (0-20)
  let constraintCompliance: number;
  if (submission.disqualified) {
    constraintCompliance = 0;
  } else if (!auditResult.passed) {
    constraintCompliance = 8;
  } else {
    constraintCompliance = 20;
  }

  // 2. Answer Quality (0-20)
  let answerQuality = 0;
  const top = submission.answer.topProtocols;
  if (top && top.length >= 3) {
    const hasRequired = top.every(
      (p) =>
        typeof p.name === "string" &&
        p.name.length > 0 &&
        typeof p.tvlUsd === "number" &&
        typeof p.recommendation === "string" &&
        p.recommendation.length > 0
    );
    answerQuality = hasRequired ? 20 : 12;
  } else if (top && top.length > 0) {
    answerQuality = 8;
  } else {
    answerQuality = 0;
  }

  // 3. Methodology Fit (0-18)
  let methodologyFit: number;
  const agentId = submission.agentId;
  const expectedAgent = classification.expectedWinnerAgentId;

  if (agentId === expectedAgent) {
    methodologyFit = 18;
  } else if (ALGORITHM_ADJACENCY[expectedAgent]?.includes(agentId)) {
    methodologyFit = 12;
  } else {
    methodologyFit = 6;
  }

  // 4. Evidence Quality (0-15)
  const traceLen = submission.reasoningTrace.length;
  let evidenceQuality: number;
  if (traceLen >= 10) {
    evidenceQuality = 15;
  } else if (traceLen >= 7) {
    evidenceQuality = 12;
  } else if (traceLen >= 4) {
    evidenceQuality = 9;
  } else if (traceLen >= 2) {
    evidenceQuality = 6;
  } else {
    evidenceQuality = 3;
  }

  // 5. Coverage Depth (0-12)
  let coverageDepth: number;
  const protocolNames = new Set(allProtocols.map((p) => p.name));
  const answeredNames = (top || []).map((p) => p.name);
  const uniqueAnswered = new Set(answeredNames.filter((n) => protocolNames.has(n)));

  if (agentId === "scout" || agentId === "compass") {
    // Breadth/A*: reward covering more protocols
    const log = submission.executionLog;
    let visited = 0;
    if ("nodesVisited" in log) visited = log.nodesVisited.length;
    else if ("closedSet" in log) visited = log.closedSet.length;
    coverageDepth = Math.min(12, Math.floor((visited / allProtocols.length) * 12));
    coverageDepth = Math.max(coverageDepth, uniqueAnswered.size >= 3 ? 6 : 3);
  } else if (agentId === "drill") {
    // DFS: reward depth
    const dfsLog = submission.executionLog as { maxDepthReached?: number };
    const depth = dfsLog.maxDepthReached ?? 0;
    coverageDepth = Math.min(12, depth * 2);
  } else if (agentId === "dash") {
    // Greedy: reward speed
    const greedyLog = submission.executionLog as { submittedAtMs?: number };
    const ms = greedyLog.submittedAtMs ?? 99999;
    coverageDepth = ms < 8000 ? 12 : ms < 12000 ? 9 : 6;
  } else {
    coverageDepth = uniqueAnswered.size >= 3 ? 8 : 5;
  }

  // 6. Reasoning Clarity (0-10)
  const summaryLen = (submission.answer.summary || "").length;
  const methodologyLen = (submission.answer.methodology || "").length;
  let reasoningClarity: number;
  if (summaryLen >= 200 && methodologyLen >= 100) {
    reasoningClarity = 10;
  } else if (summaryLen >= 100) {
    reasoningClarity = 7;
  } else if (summaryLen >= 50) {
    reasoningClarity = 5;
  } else {
    reasoningClarity = 2;
  }

  // 7. Speed Cost Efficiency (0-5)
  const ms = submission.submittedAtMs;
  let speedCostEfficiency: number;
  if (ms < 10000) {
    speedCostEfficiency = 5;
  } else if (ms < 20000) {
    speedCostEfficiency = 4;
  } else if (ms < 30000) {
    speedCostEfficiency = 3;
  } else if (ms < 40000) {
    speedCostEfficiency = 2;
  } else {
    speedCostEfficiency = 1;
  }

  const total =
    constraintCompliance +
    answerQuality +
    methodologyFit +
    evidenceQuality +
    coverageDepth +
    reasoningClarity +
    speedCostEfficiency;

  return {
    constraintCompliance,
    answerQuality,
    methodologyFit,
    evidenceQuality,
    coverageDepth,
    reasoningClarity,
    speedCostEfficiency,
    total,
  };
}
