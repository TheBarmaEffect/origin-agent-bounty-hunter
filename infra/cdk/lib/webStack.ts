import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as s3deploy from "aws-cdk-lib/aws-s3-deployment";
import * as path from "path";
import { Construct } from "constructs";

/**
 * WebStack
 *
 * Hosts the Origin frontend (Next.js static export) on S3 + CloudFront.
 *
 * Resources:
 *  - Private S3 bucket (no public access)
 *  - CloudFront distribution with Origin Access Control (OAC)
 *  - BucketDeployment to sync apps/web/dist on every CDK deploy
 *
 * Output: CloudFront distribution URL (CloudFrontUrl)
 */
export class WebStack extends cdk.Stack {
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // --- S3 bucket (private) ---
    const siteBucket = new s3.Bucket(this, "OriginWebBucket", {
      bucketName: `origin-web-${this.account}-${this.region}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
      versioned: false,
    });

    // --- Origin Access Control (replaces legacy OAI) ---
    const oac = new cloudfront.S3OriginAccessControl(this, "OriginOAC", {
      description: "OAC for Origin web frontend",
    });

    // --- CloudFront distribution ---
    this.distribution = new cloudfront.Distribution(this, "OriginCFDistribution", {
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket, {
          originAccessControl: oac,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
      },
      // SPA fallback — serve index.html for unknown paths
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
        },
      ],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    // --- Deploy static assets ---
    new s3deploy.BucketDeployment(this, "OriginWebDeploy", {
      sources: [
        s3deploy.Source.asset(
          path.join(__dirname, "../../../apps/web/dist")
        ),
      ],
      destinationBucket: siteBucket,
      distribution: this.distribution,
      distributionPaths: ["/*"],
    });

    // --- Outputs ---
    new cdk.CfnOutput(this, "CloudFrontUrl", {
      value: `https://${this.distribution.domainName}`,
      description: "Origin frontend CloudFront URL",
      exportName: "OriginCloudFrontUrl",
    });

    new cdk.CfnOutput(this, "WebBucketName", {
      value: siteBucket.bucketName,
      description: "S3 bucket hosting the frontend",
    });
  }
}
