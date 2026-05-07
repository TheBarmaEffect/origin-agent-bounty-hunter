import type { Bounty, AgentSubmission, Verdict, StrategyStats } from "@origin/shared";
import type { SSEEvent } from "@origin/shared";
import type { StorageAdapter } from "./index";

/**
 * In-memory storage adapter for demo mode.
 * Uses Maps — no file I/O, no async complications.
 */
export class LocalFileStorage implements StorageAdapter {
  private bounties: Map<string, Bounty> = new Map();
  private submissions: Map<string, AgentSubmission[]> = new Map();
  private verdicts: Map<string, Verdict> = new Map();
  private strategyStats: Map<string, StrategyStats> = new Map();
  private replayEvents: Map<string, SSEEvent[]> = new Map();

  async saveBounty(bounty: Bounty): Promise<void> {
    this.bounties.set(bounty.id, { ...bounty });
  }

  async getBounty(id: string): Promise<Bounty | null> {
    return this.bounties.get(id) ?? null;
  }

  async saveSubmission(submission: AgentSubmission): Promise<void> {
    const existing = this.submissions.get(submission.bountyId) ?? [];
    const idx = existing.findIndex((s) => s.agentId === submission.agentId);
    if (idx !== -1) {
      existing[idx] = { ...submission };
    } else {
      existing.push({ ...submission });
    }
    this.submissions.set(submission.bountyId, existing);
  }

  async getSubmissions(bountyId: string): Promise<AgentSubmission[]> {
    return this.submissions.get(bountyId) ?? [];
  }

  async saveVerdict(verdict: Verdict): Promise<void> {
    this.verdicts.set(verdict.bountyId, { ...verdict });
  }

  async getVerdict(bountyId: string): Promise<Verdict | null> {
    return this.verdicts.get(bountyId) ?? null;
  }

  async saveStrategyStats(stats: StrategyStats): Promise<void> {
    const key = `${stats.agentId}:${stats.problemType}`;
    this.strategyStats.set(key, { ...stats });
  }

  async getAllStrategyStats(): Promise<StrategyStats[]> {
    return Array.from(this.strategyStats.values());
  }

  async saveReplayEvents(bountyId: string, events: SSEEvent[]): Promise<void> {
    this.replayEvents.set(bountyId, [...events]);
  }

  async getReplayEvents(bountyId: string): Promise<SSEEvent[]> {
    return this.replayEvents.get(bountyId) ?? [];
  }

  /** Clear all in-memory state (used by /api/dev/reset) */
  reset(): void {
    this.bounties.clear();
    this.submissions.clear();
    this.verdicts.clear();
    this.strategyStats.clear();
    this.replayEvents.clear();
  }
}
