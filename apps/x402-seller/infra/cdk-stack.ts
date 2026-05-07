import * as cdk from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import * as path from "path";

// NOTE: Lambda@Edge MUST be deployed in us-east-1
// This stack must be instantiated with env: { region: 'us-east-1' }

export class X402SellerStack extends cdk.Stack {
  public readonly distributionUrl: string;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, {
      ...props,
      // Lambda@Edge requirement
      env: { region: "us-east-1", account: props?.env?.account },
    });

    // S3 bucket for DeFi data
    const dataBucket = new s3.Bucket(this, "SellerDataBucket", {
      bucketName: `origin-seller-data-${this.account}`,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Upload fixture data to S3
    new s3deploy.BucketDeployment(this, "DeployDefiData", {
      sources: [s3deploy.Source.jsonData("defi-protocols.json", [
        {"protocol": "Aerodrome", "tvl": 890000000, "volume24h": 45000000, "apy": 12.4, "chain": "Base"},
        {"protocol": "Uniswap V3", "tvl": 3200000000, "volume24h": 890000000, "apy": 8.1, "chain": "Multi"},
        {"protocol": "Curve", "tvl": 1800000000, "volume24h": 234000000, "apy": 6.7, "chain": "Multi"},
        {"protocol": "Aave V3", "tvl": 6700000000, "volume24h": 123000000, "apy": 4.2, "chain": "Multi"},
        {"protocol": "Compound", "tvl": 890000000, "volume24h": 45000000, "apy": 3.8, "chain": "Multi"},
      ])],
      destinationBucket: dataBucket,
    });

    // Lambda@Edge for x402 verification
    const verifierFn = new cloudfront.experimental.EdgeFunction(this, "X402Verifier", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "handler.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../dist"), {
        // Run build first: npm run build
      }),
      memorySize: 128,
      timeout: cdk.Duration.seconds(10),
      environment: {
        // NOTE: Lambda@Edge does not support env vars directly in viewer-request
        // Store these in SSM Parameter Store and read at cold start instead
        // Or use Lambda@Edge with origin-request which DOES support env vars
        FACILITATOR_URL: "https://x402.org/facilitator",
      },
    });

    // Grant Lambda access to S3
    dataBucket.grantRead(verifierFn);

    // CloudFront distribution
    const distribution = new cloudfront.Distribution(this, "SellerDistribution", {
      defaultBehavior: {
        origin: new origins.S3Origin(dataBucket),
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        edgeLambdas: [{
          functionVersion: verifierFn.currentVersion,
          eventType: cloudfront.LambdaEdgeEventType.VIEWER_REQUEST,
        }],
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED, // No caching — payment must be verified per request
      },
    });

    this.distributionUrl = `https://${distribution.distributionDomainName}`;

    new cdk.CfnOutput(this, "SellerEndpoint", {
      value: `${this.distributionUrl}/data/defi-protocols`,
      description: "x402-gated DeFi data endpoint",
    });

    new cdk.CfnOutput(this, "DataBucketName", {
      value: dataBucket.bucketName,
    });
  }
}
