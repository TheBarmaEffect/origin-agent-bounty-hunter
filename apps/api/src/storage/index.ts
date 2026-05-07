import type {
  Bounty,
  AgentSubmission,
  Verdict,
  StrategyStats,
} from "@origin/shared";
import type { SSEEvent } from "@origin/shared";

export interface StorageAdapter {
  saveBounty(bounty: Bounty): Promise<void>;
  getBounty(id: string): Promise<Bounty | null>;
  saveSubmission(submission: AgentSubmission): Promise<void>;
  getSubmissions(bountyId: string): Promise<AgentSubmission[]>;
  saveVerdict(verdict: Verdict): Promise<void>;
  getVerdict(bountyId: string): Promise<Verdict | null>;
  saveStrategyStats(stats: StrategyStats): Promise<void>;
  getAllStrategyStats(): Promise<StrategyStats[]>;
  saveReplayEvents(bountyId: string, events: SSEEvent[]): Promise<void>;
  getReplayEvents(bountyId: string): Promise<SSEEvent[]>;
}

const DEMO_MODE = process.env.DEMO_MODE !== "false";

let _storage: StorageAdapter;

if (DEMO_MODE) {
  // Lazy import to avoid circular issues
  const { LocalFileStorage } = require("./localFileStorage") as { LocalFileStorage: new () => StorageAdapter & { reset: () => void } };
  _storage = new LocalFileStorage();
} else {
  const { DynamoStorageAdapter } = require("./dynamoAdapter") as { DynamoStorageAdapter: new () => StorageAdapter };
  _storage = new DynamoStorageAdapter();
}

export const storage: StorageAdapter = _storage;
