import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as path from "path";
import { Construct } from "constructs";

/**
 * SellerDataStack
 *
 * Provides an x402-payment-gated data endpoint for DeFi protocol datasets.
 *
 * Architecture:
 *  - S3 bucket storing the raw dataset files
 *  - CloudFront distribution as the public-facing endpoint
 *  - Lambda@Edge (viewer-request) that intercepts every request,
 *    verifies the x402 payment proof, and either forwards the request
 *    or returns HTTP 402 Payment Required.
 *
 * IMPORTANT: Lambda@Edge functions MUST be deployed in us-east-1.
 *            Ensure this stack is instantiated with region: "us-east-1".
 *
 * Reference architecture:
 *   https://github.com/aws-samples/sample-agentcore-cloudfront-x402-payments
 */
export class SellerDataStack extends cdk.Stack {
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Lambda@Edge must be in us-east-1
    if (props?.env?.region && props.env.region !== "us-east-1") {
      throw new Error("SellerDataStack must be deployed to us-east-1 for Lambda@Edge support.");
    }

    // --- S3 bucket: DeFi protocol data ---
    const dataBucket = new s3.Bucket(this, "OriginSellerDataBucket", {
      bucketName: `origin-seller-data-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      versioned: true,
      // Lifecycle: expire raw data older than 90 days to manage costs
      lifecycleRules: [
        {
          id: "expire-old-data",
          enabled: true,
          expiration: cdk.Duration.days(90),
        },
      ],
    });

    // --- Lambda@Edge: x402 payment verification ---
    //
    // TODO: Add x402 facilitator verification logic in the Lambda@Edge function.
    // Reference: https://github.com/aws-samples/sample-agentcore-cloudfront-x402-payments
    //
    // The function should:
    //  1. Extract the X-Payment header (or Authorization Bearer) from the viewer request.
    //  2. Call the x402 facilitator (X402_FACILITATOR_URL) to verify the payment proof.
    //  3. If valid: pass the request through to the S3 origin.
    //  4. If invalid or missing: return { status: "402", body: JSON.stringify({ error: "Payment required" }) }.
    //
    // The inline placeholder below is intentionally minimal — replace with
    // the real verification implementation before production deployment.
    const x402VerifierFn = new lambda.Function(this, "X402VerifierEdgeFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      // Lambda@Edge code must be inline or from an asset; inline used here as placeholder
      code: lambda.Code.fromInline(`
'use strict';
// TODO: Replace with real x402 facilitator verification logic.
// Reference: https://github.com/aws-samples/sample-agentcore-cloudfront-x402-payments
exports.handler = async (event) => {
  const request = event.Records[0].cf.request;
  const headers = request.headers;

  const paymentHeader =
    (headers['x-payment'] && headers['x-payment'][0]?.value) ||
    (headers['authorization'] && headers['authorization'][0]?.value);

  if (!paymentHeader) {
    return {
      status: '402',
      statusDescription: 'Payment Required',
      headers: {
        'content-type': [{ key: 'Content-Type', value: 'application/json' }],
        'x-origin-version': [{ key: 'X-Origin-Version', value: '1.0.0' }],
      },
      body: JSON.stringify({
        error: 'Payment required',
        accepts: [{ scheme: 'exact', network: 'base-sepolia', maxAmountRequired: '2000000', asset: 'usdc' }],
      }),
    };
  }

  // TODO: verify paymentHeader against facilitator
  // const verified = await fetch(process.env.X402_FACILITATOR_URL + '/verify', { ... });
  // if (!verified.ok) return 402 response above;

  return request; // forward to S3 origin
};
`),
      // Lambda@Edge requires no VPC and specific memory/timeout limits
      memorySize: 128,
      timeout: cdk.Duration.seconds(5),
      description: "Origin x402 payment verifier — Lambda@Edge viewer-request",
    });

    // Lambda@Edge version (immutable)
    const edgeVersion = new lambda.Version(this, "X402VerifierEdgeVersion", {
      lambda: x402VerifierFn,
    });

    // --- Origin Access Control ---
    const oac = new cloudfront.S3OriginAccessControl(this, "SellerDataOAC", {
      description: "OAC for Origin seller data bucket",
    });

    // --- CloudFront distribution ---
    this.distribution = new cloudfront.Distribution(this, "OriginSellerDataDistribution", {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(dataBucket, {
          originAccessControl: oac,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED, // Do not cache gated responses
        edgeLambdas: [
          {
            functionVersion: edgeVersion,
            eventType: cloudfront.LambdaEdgeEventType.VIEWER_REQUEST,
          },
        ],
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      comment: "Origin x402-gated DeFi data endpoint",
    });

    // --- Outputs ---
    new cdk.CfnOutput(this, "SellerDataEndpoint", {
      value: `https://${this.distribution.domainName}`,
      description: "x402-gated seller data CloudFront endpoint",
      exportName: "OriginSellerDataEndpoint",
    });

    new cdk.CfnOutput(this, "SellerDataBucketName", {
      value: dataBucket.bucketName,
      description: "S3 bucket holding the DeFi protocol datasets",
    });
  }
}
