import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { Construct } from "constructs";

/**
 * DataStack
 *
 * Provisions all DynamoDB tables used by Origin.
 *
 * Tables:
 *  - OriginBounties          PK=bountyId
 *  - OriginSubmissions       PK=bountyId  SK=agentId
 *  - OriginVerdicts          PK=bountyId
 *  - OriginStrategyStats     PK=agentId   SK=problemType
 *  - OriginAgentReputation   PK=agentWalletAddress  SK=taskType
 *
 * All tables use PAY_PER_REQUEST billing and point-in-time recovery.
 */
export class DataStack extends cdk.Stack {
  public readonly bountiesTable: dynamodb.Table;
  public readonly submissionsTable: dynamodb.Table;
  public readonly verdictsTable: dynamodb.Table;
  public readonly strategyStatsTable: dynamodb.Table;
  public readonly agentReputationTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const tableDefaults: Partial<dynamodb.TableProps> = {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    };

    // --- OriginBounties ---
    this.bountiesTable = new dynamodb.Table(this, "OriginBounties", {
      tableName: "OriginBounties",
      partitionKey: { name: "bountyId", type: dynamodb.AttributeType.STRING },
      ...tableDefaults,
    });

    // --- OriginSubmissions ---
    this.submissionsTable = new dynamodb.Table(this, "OriginSubmissions", {
      tableName: "OriginSubmissions",
      partitionKey: { name: "bountyId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "agentId", type: dynamodb.AttributeType.STRING },
      ...tableDefaults,
    });

    // GSI: query all submissions by agentId across bounties
    this.submissionsTable.addGlobalSecondaryIndex({
      indexName: "AgentIdIndex",
      partitionKey: { name: "agentId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "bountyId", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // --- OriginVerdicts ---
    this.verdictsTable = new dynamodb.Table(this, "OriginVerdicts", {
      tableName: "OriginVerdicts",
      partitionKey: { name: "bountyId", type: dynamodb.AttributeType.STRING },
      ...tableDefaults,
    });

    // --- OriginStrategyStats ---
    this.strategyStatsTable = new dynamodb.Table(this, "OriginStrategyStats", {
      tableName: "OriginStrategyStats",
      partitionKey: { name: "agentId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "problemType", type: dynamodb.AttributeType.STRING },
      ...tableDefaults,
    });

    // --- OriginAgentReputation ---
    this.agentReputationTable = new dynamodb.Table(this, "OriginAgentReputation", {
      tableName: "OriginAgentReputation",
      partitionKey: { name: "agentWalletAddress", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "taskType", type: dynamodb.AttributeType.STRING },
      ...tableDefaults,
    });

    // --- Outputs ---
    const tables = [
      this.bountiesTable,
      this.submissionsTable,
      this.verdictsTable,
      this.strategyStatsTable,
      this.agentReputationTable,
    ];

    tables.forEach((t) => {
      new cdk.CfnOutput(this, `${t.tableName}Arn`, {
        value: t.tableArn,
        exportName: `Origin-${t.tableName}-Arn`,
      });
    });
  }
}
