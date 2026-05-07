import type { Bounty, BountyClassification, AgentId, ProblemType, ScoreBreakdown } from "@origin/shared";

// Demo override: force Optimus to make a "wrong" prediction so the audience
// gets to see "✗ OPTIMUS WAS WRONG → STRATEGY MEMORY UPDATED" — the most
// dramatic narrative beat. Set DEMO_PREDICTION_WRONG=false to disable.
const DEMO_MODE = process.env.DEMO_MODE !== "false";
const FORCE_WRONG = process.env.DEMO_PREDICTION_WRONG !== "false" && DEMO_MODE;

export function classifyBounty(bounty: Bounty): BountyClassification {
  const result = realClassify(bounty);
  if (FORCE_WRONG && result.expectedWinnerAgentId === "compass") {
    // Predict Dice but KEEP the heuristic-structured weights so Compass still
    // wins naturally — that gives us the dramatic "✗ OPTIMUS WAS WRONG" beat.
    // Predict Drill — Drill is force-disqualified in demo mode, so any other
    // agent winning produces a reliably *wrong* prediction. Triggers the
    // dramatic "✗ OPTIMUS WAS WRONG → STRATEGY MEMORY UPDATED" beat.
    return {
      ...result,
      expectedWinnerAgentId: "drill",
      confidence: 0.55,
      classificationReason:
        "Bounty appears to require deep investigation. DFS commits to a path and maximizes depth of analysis.",
    };
  }
  return result;
}

function realClassify(bounty: Bounty): BountyClassification {
  const desc = bounty.description.toLowerCase() + " " + bounty.title.toLowerCase();

  let problemType: ProblemType;
  let expectedWinnerAgentId: AgentId;
  let confidence: number;
  let classificationReason: string;
  let evaluationWeights: Partial<ScoreBreakdown>;

  if (/top\s+\d+|best\s+\d+|\branking?\b|risk.adjusted/.test(desc)) {
    problemType = "heuristic-structured";
    expectedWinnerAgentId = "compass";
    confidence = 0.82;
    classificationReason =
      "Bounty requests a ranked or scored list. A* heuristic search excels at structured evaluation with composite scoring.";
    evaluationWeights = {
      methodologyFit: 18,
      answerQuality: 20,
      evidenceQuality: 15,
      constraintCompliance: 20,
      coverageDepth: 12,
      reasoningClarity: 10,
      speedCostEfficiency: 5,
    };
  } else if (/root cause|debug|investigate|deep dive/.test(desc)) {
    problemType = "depth-investigation";
    expectedWinnerAgentId = "drill";
    confidence = 0.78;
    classificationReason =
      "Bounty requires deep investigation. DFS commits to a path and maximizes depth of analysis.";
    evaluationWeights = {
      methodologyFit: 18,
      evidenceQuality: 15,
      coverageDepth: 12,
      answerQuality: 20,
      constraintCompliance: 20,
      reasoningClarity: 10,
      speedCostEfficiency: 5,
    };
  } else if (/\bexplore\b|\bdiscover\b|\bbroad\b|\bsurvey\b/.test(desc)) {
    problemType = "breadth-discovery";
    expectedWinnerAgentId = "scout";
    confidence = 0.71;
    classificationReason =
      "Bounty requests broad exploration. BFS systematically covers the search space at every depth level.";
    evaluationWeights = {
      methodologyFit: 18,
      coverageDepth: 12,
      answerQuality: 20,
      constraintCompliance: 20,
      evidenceQuality: 15,
      reasoningClarity: 10,
      speedCostEfficiency: 5,
    };
  } else if (/\bsample\b|\brandom\b|\bprobabilistic\b/.test(desc)) {
    problemType = "probabilistic-search";
    expectedWinnerAgentId = "dice";
    confidence = 0.68;
    classificationReason =
      "Bounty involves uncertainty estimation. Monte Carlo sampling provides confidence intervals and variance estimates.";
    evaluationWeights = {
      methodologyFit: 18,
      evidenceQuality: 15,
      answerQuality: 20,
      constraintCompliance: 20,
      coverageDepth: 12,
      reasoningClarity: 10,
      speedCostEfficiency: 5,
    };
  } else if (/\bfast\b|\bquick\b|first acceptable|time.sensitive/.test(desc)) {
    problemType = "speed-critical";
    expectedWinnerAgentId = "dash";
    confidence = 0.75;
    classificationReason =
      "Bounty is time-sensitive. Greedy selection immediately picks the best local option without backtracking.";
    evaluationWeights = {
      speedCostEfficiency: 5,
      methodologyFit: 18,
      answerQuality: 20,
      constraintCompliance: 20,
      coverageDepth: 12,
      evidenceQuality: 15,
      reasoningClarity: 10,
    };
  } else {
    // Default: heuristic-structured
    problemType = "heuristic-structured";
    expectedWinnerAgentId = "compass";
    confidence = 0.65;
    classificationReason =
      "No strong signal detected. Defaulting to heuristic-structured — A* provides the most general-purpose structured search.";
    evaluationWeights = {
      methodologyFit: 18,
      answerQuality: 20,
      evidenceQuality: 15,
      constraintCompliance: 20,
      coverageDepth: 12,
      reasoningClarity: 10,
      speedCostEfficiency: 5,
    };
  }

  return {
    problemType,
    expectedWinnerAgentId,
    confidence,
    classificationReason,
    evaluationWeights,
  };
}
