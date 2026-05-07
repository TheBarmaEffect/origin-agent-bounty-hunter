export type AgentId = "scout" | "drill" | "compass" | "dice" | "dash";
export type Algorithm = "BFS" | "DFS" | "A*" | "Monte Carlo" | "Greedy";

export type ProblemType =
  | "breadth-discovery"
  | "depth-investigation"
  | "heuristic-structured"
  | "probabilistic-search"
  | "speed-critical"
  | "hybrid";

export type BountyStatus = "created" | "running" | "judging" | "paid" | "failed";
export type PaymentStatus = "unpaid" | "paid" | "demo-paid";
export type SubmissionStatus =
  | "queued"
  | "running"
  | "submitted"
  | "audit_failed"
  | "scored"
  | "disqualified";

export interface Bounty {
  id: string;
  title: string;
  description: string;
  budgetUsdc: number;
  timeLimitSeconds: number;
  status: BountyStatus;
  paymentStatus: PaymentStatus;
  createdAt: string;
  completedAt?: string;
}

export interface ScoreBreakdown {
  constraintCompliance: number; // 0-20
  answerQuality: number; // 0-20
  methodologyFit: number; // 0-18
  evidenceQuality: number; // 0-15
  coverageDepth: number; // 0-12
  reasoningClarity: number; // 0-10
  speedCostEfficiency: number; // 0-5
  total: number; // 0-100
}

export interface AuditCheck {
  rule: string;
  passed: boolean;
  detail: string;
}

export interface BFSExecutionLog {
  agentId: "scout";
  algorithm: "BFS";
  queueSnapshots: string[][];
  nodesVisited: string[];
  depthByNode: Record<string, number>;
  breadthRequirementMet: boolean;
  minBreadthN: number;
}

export interface DFSExecutionLog {
  agentId: "drill";
  algorithm: "DFS";
  stackSnapshots: string[][];
  committedPath: string[];
  backtrackEvents: { from: string; to: string; reason: string }[];
  maxDepthReached: number;
  minDfsDepth: number;
}

export interface AStarExecutionLog {
  agentId: "compass";
  algorithm: "A*";
  declaredHeuristicAt: string;
  heuristicVersion: string;
  openSetSnapshots: { name: string; f: number; g: number; h: number }[][];
  closedSet: string[];
  scoreBreakdowns: Record<string, { tvlScore: number; volumeScore: number; momentumScore: number; riskScore: number; total: number }>;
}

export interface MonteCarloExecutionLog {
  agentId: "dice";
  algorithm: "Monte Carlo";
  seed: string;
  sampleCount: number;
  sampledCandidates: string[];
  varianceEstimate: number;
  confidenceInterval: [number, number];
}

export interface GreedyExecutionLog {
  agentId: "dash";
  algorithm: "Greedy";
  decisions: { step: number; chosen: string; score: number; alternatives: string[] }[];
  backtrackCount: number;
  submittedAtMs: number;
}

export type ExecutionLog =
  | BFSExecutionLog
  | DFSExecutionLog
  | AStarExecutionLog
  | MonteCarloExecutionLog
  | GreedyExecutionLog;

export interface DefiProtocol {
  name: string;
  chain: string;
  category: string;
  tvlUsd: number;
  volume24hUsd: number;
  change24hPct: number;
  riskFlags: string[];
  source: "LIVE" | "CACHED" | "DEMO_FIXTURE";
  updatedAt: string;
}

export interface AgentAnswer {
  topProtocols: {
    rank: number;
    name: string;
    chain: string;
    tvlUsd: number;
    volume24hUsd: number;
    riskAdjustedScore: number;
    recommendation: string;
  }[];
  summary: string;
  methodology: string;
  confidence?: number;
}

export interface AgentSubmission {
  bountyId: string;
  agentId: AgentId;
  algorithm: Algorithm;
  answer: AgentAnswer;
  reasoningTrace: string[];
  executionLog: ExecutionLog;
  status: SubmissionStatus;
  submittedAtMs: number;
  scoreBreakdown?: ScoreBreakdown;
  auditChecks?: AuditCheck[];
  disqualified: boolean;
  disqualificationReason?: string;
}

export interface BountyClassification {
  problemType: ProblemType;
  expectedWinnerAgentId: AgentId;
  confidence: number;
  classificationReason: string;
  evaluationWeights: Partial<ScoreBreakdown>;
}

export interface PayoutRecord {
  from: string;
  to: string;
  amount: string;
  asset: "USDC";
  network: "eip155:84532";
  txHash?: string;
  demoMode: boolean;
  settledAt: string;
}

export interface Verdict {
  bountyId: string;
  problemType: ProblemType;
  classification: BountyClassification;
  actualWinnerAgentId: AgentId;
  optimusPredictionCorrect: boolean;
  rationale: string;
  agentSummaries: {
    agentId: AgentId;
    score: number;
    disqualified: boolean;
    disqualificationReason?: string;
    auditChecks: AuditCheck[];
  }[];
  submissions: AgentSubmission[];
  verdictHash: string;
  onchainTxHash?: string;
  payout: PayoutRecord;
  createdAt: string;
}

export interface StrategyStats {
  agentId: AgentId;
  problemType: ProblemType;
  wins: number;
  losses: number;
  disqualifications: number;
  totalRaces: number;
  averageScore: number;
  lastUpdatedAt: string;
}

export interface X402PaymentEvent {
  type:
    | "payment.challenge"
    | "payment.signed"
    | "payment.verified"
    | "payment.settled"
    | "payment.failed";
  paymentId: string;
  from: string;
  to: string;
  amount: string;
  asset: "USDC";
  network: "eip155:84532";
  purpose: string;
  timestamp: string;
}
