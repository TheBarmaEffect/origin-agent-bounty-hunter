import type {
  AgentSubmission,
  AuditCheck,
  BFSExecutionLog,
  DFSExecutionLog,
  AStarExecutionLog,
  MonteCarloExecutionLog,
  GreedyExecutionLog,
} from "@origin/shared";

export interface AuditResult {
  passed: boolean;
  checks: AuditCheck[];
  disqualificationReason?: string;
}

export function auditAgent(submission: AgentSubmission): AuditResult {
  const log = submission.executionLog;
  const checks: AuditCheck[] = [];
  let disqualificationReason: string | undefined;

  switch (submission.agentId) {
    case "scout": {
      const bfsLog = log as BFSExecutionLog;

      const breadthMet = bfsLog.breadthRequirementMet === true;
      checks.push({
        rule: "breadthRequirementMet",
        passed: breadthMet,
        detail: breadthMet
          ? "Breadth requirement satisfied"
          : "Breadth requirement NOT met — agent did not visit enough nodes at level 0",
      });

      const minNodes = bfsLog.nodesVisited.length >= 8;
      checks.push({
        rule: "minimumNodesVisited",
        passed: minNodes,
        detail: minNodes
          ? `Visited minimum distinct candidates (${bfsLog.nodesVisited.length})`
          : `Too few distinct candidates visited: ${bfsLog.nodesVisited.length} (need ≥8)`,
      });

      const queueLogged = bfsLog.queueSnapshots.length >= 2;
      checks.push({
        rule: "queueStateLogged",
        passed: queueLogged,
        detail: queueLogged
          ? "Queue state was logged"
          : `Queue snapshots insufficient: ${bfsLog.queueSnapshots.length} (need ≥2)`,
      });

      const depthOk = bfsLog.breadthRequirementMet;
      checks.push({
        rule: "depthConstraintRespected",
        passed: depthOk,
        detail: depthOk
          ? "Breadth-first ordering constraint respected"
          : "Agent may have violated BFS ordering before breadth condition was met",
      });

      if (!breadthMet || !minNodes) {
        disqualificationReason = !breadthMet
          ? "Breadth requirement was not met (breadthRequirementMet=false)"
          : `Insufficient nodes visited: ${bfsLog.nodesVisited.length} < 8`;
      }
      break;
    }

    case "drill": {
      const dfsLog = log as DFSExecutionLog;

      const minDepth = dfsLog.maxDepthReached >= 3;
      checks.push({
        rule: "minimumDfsDepth",
        passed: minDepth,
        detail: minDepth
          ? `Reached minimum DFS depth (${dfsLog.maxDepthReached})`
          : `Max depth too shallow: ${dfsLog.maxDepthReached} (need ≥3)`,
      });

      const pathLen = dfsLog.committedPath.length >= 3;
      checks.push({
        rule: "committedPathLength",
        passed: pathLen,
        detail: pathLen
          ? `Maintained committed path (length ${dfsLog.committedPath.length})`
          : `Committed path too short: ${dfsLog.committedPath.length} (need ≥3)`,
      });

      const stackLogged = dfsLog.stackSnapshots.length >= 2;
      checks.push({
        rule: "stackStateLogged",
        passed: stackLogged,
        detail: stackLogged
          ? "Stack state was logged"
          : `Stack snapshots insufficient: ${dfsLog.stackSnapshots.length} (need ≥2)`,
      });

      const backtrackLogged = Array.isArray(dfsLog.backtrackEvents);
      checks.push({
        rule: "backtrackEventsRecorded",
        passed: backtrackLogged,
        detail: backtrackLogged
          ? "Backtrack events recorded"
          : "Backtrack events array missing",
      });

      if (!minDepth) {
        disqualificationReason = `DFS max depth ${dfsLog.maxDepthReached} is below minimum of 3`;
      }
      break;
    }

    case "compass": {
      const astarLog = log as AStarExecutionLog;

      const heuristicDeclared = typeof astarLog.declaredHeuristicAt === "string" && astarLog.declaredHeuristicAt.length > 0;
      checks.push({
        rule: "heuristicDeclaredBeforeScoring",
        passed: heuristicDeclared,
        detail: heuristicDeclared
          ? "Heuristic declared before scoring"
          : "Heuristic declaration timestamp missing",
      });

      const heuristicVersion = typeof astarLog.heuristicVersion === "string" && astarLog.heuristicVersion.length > 0;
      checks.push({
        rule: "heuristicVersionPresent",
        passed: heuristicVersion,
        detail: heuristicVersion
          ? "Heuristic version hash present"
          : "Heuristic version string is empty",
      });

      const openSetLogged = astarLog.openSetSnapshots.length >= 2;
      checks.push({
        rule: "openSetStateLogged",
        passed: openSetLogged,
        detail: openSetLogged
          ? "Open set state logged"
          : `Open set snapshots insufficient: ${astarLog.openSetSnapshots.length} (need ≥2)`,
      });

      const breakdowns = Object.values(astarLog.scoreBreakdowns);
      const fullDecomposition =
        breakdowns.length > 0 &&
        breakdowns.every(
          (b) =>
            typeof b.tvlScore === "number" &&
            typeof b.volumeScore === "number" &&
            typeof b.momentumScore === "number" &&
            typeof b.riskScore === "number"
        );
      checks.push({
        rule: "fullScoreDecomposition",
        passed: fullDecomposition,
        detail: fullDecomposition
          ? "Full score decomposition present (tvlScore, volumeScore, momentumScore, riskScore)"
          : "Score breakdowns missing required fields",
      });

      if (!heuristicVersion) {
        disqualificationReason = "Heuristic version is empty — algorithm identity cannot be verified";
      }
      break;
    }

    case "dice": {
      const mcLog = log as MonteCarloExecutionLog;

      const minSamples = mcLog.sampleCount >= 10;
      checks.push({
        rule: "minimumSampleCount",
        passed: minSamples,
        detail: minSamples
          ? `Minimum sample count met (${mcLog.sampleCount})`
          : `Too few samples: ${mcLog.sampleCount} (need ≥10)`,
      });

      const seedPresent = typeof mcLog.seed === "string" && mcLog.seed.length > 0;
      checks.push({
        rule: "randomSeedRecorded",
        passed: seedPresent,
        detail: seedPresent ? "Random seed recorded" : "Seed is missing or empty",
      });

      const varianceOk = typeof mcLog.varianceEstimate === "number" && mcLog.varianceEstimate > 0;
      checks.push({
        rule: "varianceEstimated",
        passed: varianceOk,
        detail: varianceOk
          ? `Variance estimated (${mcLog.varianceEstimate.toFixed(4)})`
          : "Variance estimate is zero or missing",
      });

      const ciOk = Array.isArray(mcLog.confidenceInterval) && mcLog.confidenceInterval.length === 2;
      checks.push({
        rule: "confidenceIntervalComputed",
        passed: ciOk,
        detail: ciOk
          ? `Confidence interval computed [${mcLog.confidenceInterval[0].toFixed(3)}, ${mcLog.confidenceInterval[1].toFixed(3)}]`
          : "Confidence interval missing or malformed",
      });

      if (!minSamples) {
        disqualificationReason = `Sample count ${mcLog.sampleCount} is below minimum of 10`;
      }
      break;
    }

    case "dash": {
      const greedyLog = log as GreedyExecutionLog;

      const noBacktrack = greedyLog.backtrackCount === 0;
      checks.push({
        rule: "noBacktracking",
        passed: noBacktrack,
        detail: noBacktrack
          ? "No backtracking (greedy compliance)"
          : `Backtracking detected: ${greedyLog.backtrackCount} events`,
      });

      const timeOk = greedyLog.submittedAtMs <= 15000;
      checks.push({
        rule: "greedyTimeLimit",
        passed: timeOk,
        detail: timeOk
          ? `Submitted within greedy time limit (${greedyLog.submittedAtMs}ms)`
          : `Submission too slow for greedy: ${greedyLog.submittedAtMs}ms (limit 15000ms)`,
      });

      const decisionLog = greedyLog.decisions.length >= 1;
      checks.push({
        rule: "decisionLogPresent",
        passed: decisionLog,
        detail: decisionLog
          ? `Decision log present (${greedyLog.decisions.length} decisions)`
          : "Decision log is empty",
      });

      if (!noBacktrack) {
        disqualificationReason = `Greedy agent performed ${greedyLog.backtrackCount} backtrack(s) — violates greedy constraint`;
      }
      break;
    }
  }

  const passed = checks.every((c) => c.passed) && !disqualificationReason;

  return { passed, checks, disqualificationReason };
}
