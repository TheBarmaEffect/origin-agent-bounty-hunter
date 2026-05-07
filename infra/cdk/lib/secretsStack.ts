import * as cdk from "aws-cdk-lib";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";

/**
 * SecretsStack
 *
 * Creates placeholder Secrets Manager entries for all Origin runtime secrets.
 * The secret values are initialised to empty strings — populate them via the
 * AWS console or CLI before deploying AppStack:
 *
 *   aws secretsmanager put-secret-value \
 *     --secret-id origin/CDP_API_KEY_ID \
 *     --secret-string "your-real-value"
 *
 * Secrets:
 *  - origin/CDP_API_KEY_ID          Coinbase CDP API key name
 *  - origin/CDP_API_KEY_SECRET      Coinbase CDP API key private key (PEM)
 *  - origin/CDP_WALLET_SECRET       Coinbase CDP wallet data (JSON)
 *  - origin/BASE_SEPOLIA_RPC_URL    JSON-RPC endpoint for Base Sepolia
 *  - origin/VERDICT_PRIVATE_KEY     Wallet private key for verdict publisher
 *  - origin/X402_FACILITATOR_URL    x402 facilitator service base URL
 */
export class SecretsStack extends cdk.Stack {
  // Expose secret ARNs so AppStack can grant read access to the ECS task role
  public readonly cdpApiKeyIdArn: string;
  public readonly cdpApiKeySecretArn: string;
  public readonly cdpWalletSecretArn: string;
  public readonly baseSepoliaRpcUrlArn: string;
  public readonly verdictPrivateKeyArn: string;
  public readonly x402FacilitatorUrlArn: string;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const makeSecret = (
      logicalId: string,
      secretName: string,
      description: string
    ): secretsmanager.Secret => {
      const secret = new secretsmanager.Secret(this, logicalId, {
        secretName,
        description,
        // Placeholder — rotate / populate before production use
        generateSecretString: {
          secretStringTemplate: JSON.stringify({ value: "" }),
          generateStringKey: "_unused",
          excludeCharacters: " ",
        },
        removalPolicy: cdk.RemovalPolicy.RETAIN,
      });

      new cdk.CfnOutput(this, `${logicalId}Arn`, {
        value: secret.secretArn,
        exportName: `Origin-${logicalId}-Arn`,
      });

      return secret;
    };

    const cdpApiKeyId = makeSecret(
      "CdpApiKeyId",
      "origin/CDP_API_KEY_ID",
      "Coinbase CDP API key name (not the secret, just the ID)"
    );

    const cdpApiKeySecret = makeSecret(
      "CdpApiKeySecret",
      "origin/CDP_API_KEY_SECRET",
      "Coinbase CDP API key private key (PEM format)"
    );

    const cdpWalletSecret = makeSecret(
      "CdpWalletSecret",
      "origin/CDP_WALLET_SECRET",
      "Coinbase CDP wallet export JSON (used by AgentKit)"
    );

    const baseSepoliaRpcUrl = makeSecret(
      "BaseSepoliaRpcUrl",
      "origin/BASE_SEPOLIA_RPC_URL",
      "JSON-RPC URL for Base Sepolia (eip155:84532)"
    );

    const verdictPrivateKey = makeSecret(
      "VerdictPrivateKey",
      "origin/VERDICT_PRIVATE_KEY",
      "Private key of the wallet authorised to publish verdicts on-chain (Base Sepolia)"
    );

    const x402FacilitatorUrl = makeSecret(
      "X402FacilitatorUrl",
      "origin/X402_FACILITATOR_URL",
      "Base URL of the x402 facilitator service (e.g. https://facilitator.x402.org)"
    );

    // Expose ARNs for cross-stack references
    this.cdpApiKeyIdArn = cdpApiKeyId.secretArn;
    this.cdpApiKeySecretArn = cdpApiKeySecret.secretArn;
    this.cdpWalletSecretArn = cdpWalletSecret.secretArn;
    this.baseSepoliaRpcUrlArn = baseSepoliaRpcUrl.secretArn;
    this.verdictPrivateKeyArn = verdictPrivateKey.secretArn;
    this.x402FacilitatorUrlArn = x402FacilitatorUrl.secretArn;
  }
}
