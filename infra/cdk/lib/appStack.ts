import * as cdk from "aws-cdk-lib";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

/**
 * AppStack
 *
 * Hosts the Origin Express API on ECS Fargate behind an Application Load Balancer.
 *
 * WHY NOT LAMBDA?
 * ---------------
 * The Origin API uses Server-Sent Events (SSE) to stream live scoring updates
 * to the frontend while a bounty round is in progress. AWS Lambda does NOT
 * support long-lived HTTP connections — its maximum execution time is 15 minutes
 * and it cannot keep a response stream open indefinitely.  ECS Fargate (or App
 * Runner) is the correct choice because the container process stays alive for as
 * long as a client is connected.
 *
 * Resources:
 *  - ECR repository for the API container image
 *  - VPC (2 AZs, public + private subnets)
 *  - ECS Cluster + Fargate service
 *  - Application Load Balancer (internet-facing, port 80 → container port 3001)
 *  - IAM task role with least-privilege permissions
 *
 * TODO: Build and push the container image before running `cdk deploy`:
 *   docker build -t origin-api ./apps/api
 *   aws ecr get-login-password | docker login --username AWS --password-stdin <ecr-url>
 *   docker tag origin-api:latest <ecr-url>/origin-api:latest
 *   docker push <ecr-url>/origin-api:latest
 */
export class AppStack extends cdk.Stack {
  public readonly loadBalancerDnsName: string;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // --- ECR repository ---
    const repository = new ecr.Repository(this, "OriginApiRepo", {
      repositoryName: "origin-api",
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      imageScanOnPush: true,
      lifecycleRules: [
        {
          // Keep only the 10 most recent images to limit storage cost
          maxImageCount: 10,
          rulePriority: 1,
          description: "Keep last 10 images",
        },
      ],
    });

    // --- VPC ---
    const vpc = new ec2.Vpc(this, "OriginVpc", {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        { name: "Public", subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: "Private", subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 24 },
      ],
    });

    // --- ECS Cluster ---
    const cluster = new ecs.Cluster(this, "OriginCluster", {
      vpc,
      containerInsights: true,
      clusterName: "origin-cluster",
    });

    // --- IAM task role ---
    const taskRole = new iam.Role(this, "OriginApiTaskRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      description: "ECS task role for the Origin API — Fargate",
    });

    // DynamoDB: read/write all Origin tables
    taskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:BatchWriteItem",
          "dynamodb:BatchGetItem",
        ],
        resources: [
          `arn:aws:dynamodb:${this.region}:${this.account}:table/Origin*`,
        ],
      })
    );

    // Secrets Manager: read Origin secrets
    taskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["secretsmanager:GetSecretValue"],
        resources: [
          `arn:aws:secretsmanager:${this.region}:${this.account}:secret:origin/*`,
        ],
      })
    );

    // Bedrock: invoke Claude for Optimus scoring explanations
    taskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
        resources: ["arn:aws:bedrock:*::foundation-model/anthropic.*"],
      })
    );

    // --- Fargate task definition ---
    const taskDef = new ecs.FargateTaskDefinition(this, "OriginApiTaskDef", {
      memoryLimitMiB: 512,
      cpu: 256,
      taskRole,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.X86_64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
    });

    // TODO: replace imageTag with the actual pushed image tag after first build
    const container = taskDef.addContainer("OriginApiContainer", {
      image: ecs.ContainerImage.fromEcrRepository(repository, "latest"),
      memoryLimitMiB: 512,
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: "origin-api" }),
      environment: {
        NODE_ENV: "production",
        PORT: "3001",
        AWS_REGION: this.region,
        BEDROCK_REGION: this.region,
      },
      // Secrets injected at runtime from Secrets Manager
      // TODO: Uncomment and wire up after SecretsStack is deployed
      // secrets: {
      //   CDP_API_KEY_ID: ecs.Secret.fromSecretsManager(cdpApiKeyIdSecret),
      //   CDP_API_KEY_SECRET: ecs.Secret.fromSecretsManager(cdpApiKeySecret),
      //   VERDICT_PRIVATE_KEY: ecs.Secret.fromSecretsManager(verdictPrivateKeySecret),
      // },
      portMappings: [{ containerPort: 3001 }],
      healthCheck: {
        command: ["CMD-SHELL", "curl -f http://localhost:3001/health || exit 1"],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    // --- Security groups ---
    const albSg = new ec2.SecurityGroup(this, "AlbSg", {
      vpc,
      description: "ALB security group",
      allowAllOutbound: true,
    });
    albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), "HTTP");
    albSg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), "HTTPS");

    const taskSg = new ec2.SecurityGroup(this, "TaskSg", {
      vpc,
      description: "Fargate task security group",
      allowAllOutbound: true,
    });
    taskSg.addIngressRule(albSg, ec2.Port.tcp(3001), "Allow ALB to task");

    // --- Fargate service ---
    const service = new ecs.FargateService(this, "OriginApiService", {
      cluster,
      taskDefinition: taskDef,
      desiredCount: 1,
      assignPublicIp: false,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [taskSg],
      circuitBreaker: { rollback: true },
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
    });

    // --- Application Load Balancer ---
    const alb = new elbv2.ApplicationLoadBalancer(this, "OriginAlb", {
      vpc,
      internetFacing: true,
      securityGroup: albSg,
      loadBalancerName: "origin-alb",
    });

    const listener = alb.addListener("HttpListener", {
      port: 80,
      defaultAction: elbv2.ListenerAction.fixedResponse(503, {
        messageBody: "No targets",
      }),
    });

    const targetGroup = listener.addTargets("OriginApiTargets", {
      port: 3001,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [service],
      healthCheck: {
        path: "/health",
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyHttpCodes: "200",
      },
      deregistrationDelay: cdk.Duration.seconds(30),
    });

    this.loadBalancerDnsName = alb.loadBalancerDnsName;

    // --- Outputs ---
    new cdk.CfnOutput(this, "ApiEndpoint", {
      value: `http://${alb.loadBalancerDnsName}`,
      description: "Origin API ALB endpoint",
      exportName: "OriginApiEndpoint",
    });

    new cdk.CfnOutput(this, "EcrRepositoryUri", {
      value: repository.repositoryUri,
      description: "ECR repository URI for the Origin API image",
      exportName: "OriginEcrRepositoryUri",
    });
  }
}
