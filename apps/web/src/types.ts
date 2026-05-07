export type AgentId = "scout" | "drill" | "compass" | "dice" | "dash";
export type Algorithm = "BFS" | "DFS" | "A*" | "Monte Carlo" | "Greedy";
export type AgentStatus = "queued" | "running" | "submitted" | "audit_failed" | "scored" | "disqualified" | "won" | "lost";
export type BountyStatus = "idle" | "created" | "running" | "judging" | "paid" | "failed";

export interface ScoreBreakdown {
  constraintCompliance: number;
  answerQuality: number;
  methodologyFit: number;
  evidenceQuality: number;
  coverageDepth: number;
  reasoningClarity: number;
  speedCostEfficiency: number;
  total: number;
}

export interface AuditCheck {
  rule: string;
  passed: boolean;
  detail: string;
}

export interface AgentState {
  agentId: AgentId;
  algorithm: Algorithm;
  status: AgentStatus;
  progress: number; // 0-100
  progressLog: string[];
  auditChecks: AuditCheck[];
  score?: ScoreBreakdown;
  submittedAtMs?: number;
  disqualified: boolean;
  disqualificationReason?: string;
}

export interface Classification {
  problemType: string;
  expectedWinnerAgentId: AgentId;
  confidence: number;
  classificationReason: string;
}

export interface PaymentState {
  stage: "idle" | "started" | "challenge" | "settled" | "failed";
  paymentId?: string;
  txHash?: string;
  amount?: string;
  demoMode?: boolean;
}

export interface ProofState {
  verdictHash?: string;
  onchainTxHash?: string;
  network?: string;
}

export interface BountyRace {
  bountyId: string;
  title: string;
  budgetUsdc: number;
  status: BountyStatus;
  classification?: Classification;
  agents: Record<AgentId, AgentState>;
  winnerAgentId?: AgentId;
  rationale?: string;
  predictionCorrect?: boolean;
  payment: PaymentState;
  proof: ProofState;
  strategyStats: StrategyStats[];
  elapsedMs: number;
}

export interface StrategyStats {
  agentId: AgentId;
  problemType: string;
  wins: number;
  losses: number;
  disqualifications: number;
  totalRaces: number;
  averageScore: number;
}
