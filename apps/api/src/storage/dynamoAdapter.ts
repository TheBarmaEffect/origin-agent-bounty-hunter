// TODO: Install @aws-sdk/client-dynamodb and @aws-sdk/lib-dynamodb
// TODO: Configure with AWS_REGION env var
// This is the production adapter. Use LocalFileStorage for demo mode.
//
// Example setup:
//   npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
//   export AWS_REGION=us-east-1
//   export DYNAMODB_TABLE_PREFIX=origin-bounty-

import type { Bounty, AgentSubmission, Verdict, StrategyStats } from "@origin/shared";
import type { SSEEvent } from "@origin/shared";
import type { StorageAdapter } from "./index";

class NotImplementedError extends Error {
  constructor(method: string) {
    super(
      `DynamoStorageAdapter.${method} is not yet implemented. ` +
        "Install @aws-sdk/client-dynamodb, configure AWS_REGION, and implement the DynamoDB calls."
    );
    this.name = "NotImplementedError";
  }
}

export class DynamoStorageAdapter implements StorageAdapter {
  // TODO: Initialize DynamoDBDocumentClient here
  // private client: DynamoDBDocumentClient;
  // private tablePrefix: string;
  //
  // constructor() {
  //   const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
  //   const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");
  //   this.client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.AWS_REGION }));
  //   this.tablePrefix = process.env.DYNAMODB_TABLE_PREFIX || "origin-bounty-";
  // }

  async saveBounty(_bounty: Bounty): Promise<void> {
    throw new NotImplementedError("saveBounty");
  }

  async getBounty(_id: string): Promise<Bounty | null> {
    throw new NotImplementedError("getBounty");
  }

  async saveSubmission(_submission: AgentSubmission): Promise<void> {
    throw new NotImplementedError("saveSubmission");
  }

  async getSubmissions(_bountyId: string): Promise<AgentSubmission[]> {
    throw new NotImplementedError("getSubmissions");
  }

  async saveVerdict(_verdict: Verdict): Promise<void> {
    throw new NotImplementedError("saveVerdict");
  }

  async getVerdict(_bountyId: string): Promise<Verdict | null> {
    throw new NotImplementedError("getVerdict");
  }

  async saveStrategyStats(_stats: StrategyStats): Promise<void> {
    throw new NotImplementedError("saveStrategyStats");
  }

  async getAllStrategyStats(): Promise<StrategyStats[]> {
    throw new NotImplementedError("getAllStrategyStats");
  }

  async saveReplayEvents(_bountyId: string, _events: SSEEvent[]): Promise<void> {
    throw new NotImplementedError("saveReplayEvents");
  }

  async getReplayEvents(_bountyId: string): Promise<SSEEvent[]> {
    throw new NotImplementedError("getReplayEvents");
  }
}
