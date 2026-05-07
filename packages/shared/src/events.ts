import type {
  AgentId,
  AgentSubmission,
  AuditCheck,
  BountyClassification,
  ProblemType,
  ScoreBreakdown,
  StrategyStats,
  Verdict,
} from "./types";

export type SSEEventType =
  | "bounty.created"
  | "bounty.payment_required"
  | "bounty.payment_verified"
  | "optimus.classifying"
  | "optimus.classified"
  | "bounty.dispatched"
  | "agent.queued"
  | "agent.running"
  | "agent.progress"
  | "agent.submitted"
  | "agent.audit_started"
  | "agent.audit_passed"
  | "agent.audit_failed"
  | "agent.scored"
  | "optimus.judging"
  | "optimus.verdict"
  | "payment.started"
  | "payment.challenge"
  | "payment.settled"
  | "proof.hash_created"
  | "proof.onchain_published"
  | "strategy_memory.updated"
  | "bounty.completed"
  | "replay.ready";

export interface BaseSSEEvent {
  id: string;
  bountyId: string;
  type: SSEEventType;
  timestamp: string;
}

export interface BountyCreatedEvent extends BaseSSEEvent {
  type: "bounty.created";
  payload: { title: string; budgetUsdc: number; timeLimitSeconds: number };
}

export interface BountyPaymentRequiredEvent extends BaseSSEEvent {
  type: "bounty.payment_required";
  payload: { amount: string; asset: "USDC"; network: string; endpoint: string };
}

export interface BountyPaymentVerifiedEvent extends BaseSSEEvent {
  type: "bounty.payment_verified";
  payload: { paymentId: string; demoMode: boolean };
}

export interface OptimusClassifyingEvent extends BaseSSEEvent {
  type: "optimus.classifying";
  payload: { message: string };
}

export interface OptimusClassifiedEvent extends BaseSSEEvent {
  type: "optimus.classified";
  payload: BountyClassification;
}

export interface BountyDispatchedEvent extends BaseSSEEvent {
  type: "bounty.dispatched";
  payload: { agentIds: AgentId[] };
}

export interface AgentQueuedEvent extends BaseSSEEvent {
  type: "agent.queued";
  payload: { agentId: AgentId; algorithm: string };
}

export interface AgentRunningEvent extends BaseSSEEvent {
  type: "agent.running";
  payload: { agentId: AgentId; startedAtMs: number };
}

export interface AgentProgressEvent extends BaseSSEEvent {
  type: "agent.progress";
  payload: {
    agentId: AgentId;
    step: string;
    detail: string;
    progress: number; // 0-100
  };
}

export interface AgentSubmittedEvent extends BaseSSEEvent {
  type: "agent.submitted";
  payload: { agentId: AgentId; submittedAtMs: number; algorithmSummary: string };
}

export interface AgentAuditStartedEvent extends BaseSSEEvent {
  type: "agent.audit_started";
  payload: { agentId: AgentId };
}

export interface AgentAuditPassedEvent extends BaseSSEEvent {
  type: "agent.audit_passed";
  payload: { agentId: AgentId; checks: AuditCheck[] };
}

export interface AgentAuditFailedEvent extends BaseSSEEvent {
  type: "agent.audit_failed";
  payload: { agentId: AgentId; checks: AuditCheck[]; reason: string };
}

export interface AgentScoredEvent extends BaseSSEEvent {
  type: "agent.scored";
  payload: { agentId: AgentId; scoreBreakdown: ScoreBreakdown };
}

export interface OptimusJudgingEvent extends BaseSSEEvent {
  type: "optimus.judging";
  payload: { message: string };
}

export interface OptimusVerdictEvent extends BaseSSEEvent {
  type: "optimus.verdict";
  payload: {
    winnerAgentId: AgentId;
    rationale: string;
    predictionCorrect: boolean;
    expectedAgentId: AgentId;
    problemType: ProblemType;
  };
}

export interface PaymentStartedEvent extends BaseSSEEvent {
  type: "payment.started";
  payload: { from: string; to: string; amount: string; asset: "USDC" };
}

export interface PaymentChallengeEvent extends BaseSSEEvent {
  type: "payment.challenge";
  payload: { paymentId: string; challengeHash: string };
}

export interface PaymentSettledEvent extends BaseSSEEvent {
  type: "payment.settled";
  payload: { paymentId: string; txHash: string; demoMode: boolean };
}

export interface ProofHashCreatedEvent extends BaseSSEEvent {
  type: "proof.hash_created";
  payload: { verdictHash: string };
}

export interface ProofOnchainPublishedEvent extends BaseSSEEvent {
  type: "proof.onchain_published";
  payload: { txHash: string; network: string; contractAddress: string };
}

export interface StrategyMemoryUpdatedEvent extends BaseSSEEvent {
  type: "strategy_memory.updated";
  payload: { stats: StrategyStats[] };
}

export interface BountyCompletedEvent extends BaseSSEEvent {
  type: "bounty.completed";
  payload: { verdict: Verdict };
}

export interface ReplayReadyEvent extends BaseSSEEvent {
  type: "replay.ready";
  payload: { bountyId: string; eventCount: number };
}

export type SSEEvent =
  | BountyCreatedEvent
  | BountyPaymentRequiredEvent
  | BountyPaymentVerifiedEvent
  | OptimusClassifyingEvent
  | OptimusClassifiedEvent
  | BountyDispatchedEvent
  | AgentQueuedEvent
  | AgentRunningEvent
  | AgentProgressEvent
  | AgentSubmittedEvent
  | AgentAuditStartedEvent
  | AgentAuditPassedEvent
  | AgentAuditFailedEvent
  | AgentScoredEvent
  | OptimusJudgingEvent
  | OptimusVerdictEvent
  | PaymentStartedEvent
  | PaymentChallengeEvent
  | PaymentSettledEvent
  | ProofHashCreatedEvent
  | ProofOnchainPublishedEvent
  | StrategyMemoryUpdatedEvent
  | BountyCompletedEvent
  | ReplayReadyEvent;
