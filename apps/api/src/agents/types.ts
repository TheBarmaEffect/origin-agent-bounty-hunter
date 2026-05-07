import type { AgentId, Algorithm, AgentSubmission, DefiProtocol } from "@origin/shared";

export interface AgentRuntime {
  agentId: AgentId;
  algorithm: Algorithm;
  run(
    bountyId: string,
    protocols: DefiProtocol[],
    timeLimitMs: number,
    emitProgress: (step: string, detail: string, progress: number) => void
  ): Promise<AgentSubmission>;
}
