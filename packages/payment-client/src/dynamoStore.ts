import type { PaymentReceipt } from "./types";

/**
 * DynamoDB store for OriginAgentSpend table.
 *
 * Table schema:
 *   PK: agentId
 *   SK: timestamp#receiptHash
 *   Fields: url, amountPaid, success, receiptHash, txHash
 *
 * Only active when DYNAMODB_TABLE env var is set and AWS credentials present.
 * Falls back to no-op in demo mode.
 */
export class DynamoReceiptStore {
  private readonly tableName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any = null;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getClient(): Promise<any> {
    if (this.client) return this.client;
    // Dynamic import avoids compile-time dependency on @aws-sdk/client-dynamodb
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb" as string as never) as any;
    this.client = new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" });
    return this.client;
  }

  async write(receipt: PaymentReceipt): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PutItemCommand } = await import("@aws-sdk/client-dynamodb" as string as never) as any;
    const client = await this.getClient();
    await client.send(
      new PutItemCommand({
        TableName: this.tableName,
        Item: {
          agentId: { S: receipt.agentId },
          sk: { S: `${receipt.timestamp}#${receipt.receiptHash}` },
          url: { S: receipt.url },
          amountPaid: { N: String(receipt.amount) },
          success: { BOOL: true },
          receiptHash: { S: receipt.receiptHash },
          txHash: { S: receipt.txHash },
        },
      })
    );
  }

  async getByAgent(agentId: string): Promise<PaymentReceipt[]> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { QueryCommand } = await import("@aws-sdk/client-dynamodb" as string as never) as any;
    const client = await this.getClient();
    const result = await client.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: "agentId = :aid",
        ExpressionAttributeValues: { ":aid": { S: agentId } },
      })
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (result.Items || []).map((item: any) => ({
      agentId: item.agentId?.S || "",
      url: item.url?.S || "",
      amount: Number(item.amountPaid?.N || 0),
      txHash: item.txHash?.S || "",
      timestamp: item.sk?.S?.split("#")[0] || "",
      receiptHash: item.receiptHash?.S || "",
    }));
  }
}
