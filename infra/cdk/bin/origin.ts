#!/usr/bin/env node
import "constructs";
import * as cdk from "aws-cdk-lib";
import { WebStack } from "../lib/webStack";
import { DataStack } from "../lib/dataStack";
import { SellerDataStack } from "../lib/sellerDataStack";
import { SecretsStack } from "../lib/secretsStack";
import { AppStack } from "../lib/appStack";

const app = new cdk.App();

const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || "us-east-1",
};

// Secrets — deploy first so other stacks can reference ARNs
const secretsStack = new SecretsStack(app, "OriginSecretsStack", { env });

// DynamoDB tables
const dataStack = new DataStack(app, "OriginDataStack", { env });

// x402-gated seller data endpoint (Lambda@Edge must be us-east-1)
const sellerDataStack = new SellerDataStack(app, "OriginSellerDataStack", {
  env: { account: env.account, region: "us-east-1" },
});

// Express API on ECS Fargate / App Runner
const appStack = new AppStack(app, "OriginAppStack", { env });
appStack.addDependency(dataStack);
appStack.addDependency(secretsStack);

// Frontend S3 + CloudFront
const webStack = new WebStack(app, "OriginWebStack", { env });
webStack.addDependency(appStack);

app.synth();
