export interface VerifyResult {
  isValid: boolean;
  invalidReason?: string;
  txHash?: string;
}

const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
// keccak256("Transfer(address,address,uint256)")
const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

/**
 * Verify a payment header. Two paths:
 *   1. scheme=onchain: client already settled on Base Sepolia. Verify the tx
 *      via RPC (status, USDC contract, recipient, amount).
 *   2. otherwise: forward to the x402 facilitator (legacy path).
 */
export async function verifyPayment(
  paymentHeader: string,
  paymentSpec: any
): Promise<VerifyResult> {
  const requirements = paymentSpec.accepts[0];

  // Try parsing the header to detect onchain scheme
  let parsedHeader: any = null;
  try {
    parsedHeader = JSON.parse(paymentHeader);
  } catch {
    // not JSON — fall through to facilitator
  }

  if (parsedHeader?.payload) {
    let payload: any = null;
    try {
      payload = JSON.parse(Buffer.from(parsedHeader.payload, "base64").toString());
    } catch {
      // not our scheme
    }
    if (payload?.scheme === "onchain" && payload?.txHash) {
      return verifyOnchain(payload, requirements);
    }
  }

  return verifyViaFacilitator(paymentHeader, paymentSpec);
}

async function verifyOnchain(
  payload: { txHash: string; to: string; value: string; asset: string },
  requirements: { payTo: string; asset: string; maxAmountRequired: string }
): Promise<VerifyResult> {
  try {
    const { default: axios } = await import("axios");
    const res = await axios.post(
      RPC_URL,
      {
        jsonrpc: "2.0",
        id: 1,
        method: "eth_getTransactionReceipt",
        params: [payload.txHash],
      },
      { timeout: 10_000 }
    );

    const receipt = res.data?.result;
    if (!receipt) {
      return { isValid: false, invalidReason: `tx not found: ${payload.txHash}` };
    }
    if (receipt.status !== "0x1") {
      return { isValid: false, invalidReason: `tx not successful: status=${receipt.status}` };
    }
    if (
      String(receipt.to).toLowerCase() !== String(requirements.asset).toLowerCase()
    ) {
      return {
        isValid: false,
        invalidReason: `tx to=${receipt.to} != USDC contract ${requirements.asset}`,
      };
    }

    // Find a Transfer log to the required payTo with amount >= required
    const required = BigInt(requirements.maxAmountRequired);
    const payToPadded = `0x${requirements.payTo.toLowerCase().replace(/^0x/, "").padStart(64, "0")}`;

    const transferLog = (receipt.logs || []).find(
      (l: any) =>
        Array.isArray(l.topics) &&
        l.topics[0] === TRANSFER_TOPIC &&
        l.topics[2]?.toLowerCase() === payToPadded
    );

    if (!transferLog) {
      return {
        isValid: false,
        invalidReason: `no USDC Transfer log to ${requirements.payTo}`,
      };
    }

    const transferred = BigInt(transferLog.data);
    if (transferred < required) {
      return {
        isValid: false,
        invalidReason: `transferred ${transferred} < required ${required}`,
      };
    }

    return { isValid: true, txHash: payload.txHash };
  } catch (err: any) {
    return {
      isValid: false,
      invalidReason: `RPC verification failed: ${err.message}`,
    };
  }
}

async function verifyViaFacilitator(
  paymentHeader: string,
  paymentSpec: any
): Promise<VerifyResult> {
  const facilitatorUrl = process.env.FACILITATOR_URL || "https://x402.org/facilitator";

  try {
    const { default: axios } = await import("axios");
    const response = await axios.post(
      `${facilitatorUrl}/verify`,
      {
        x402Version: 1,
        paymentHeader,
        paymentRequirements: paymentSpec.accepts[0],
      },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 10_000,
      }
    );
    const data = response.data;
    return {
      isValid: data.isValid === true,
      invalidReason: data.invalidReason,
      txHash: data.txHash,
    };
  } catch (err: any) {
    return {
      isValid: false,
      invalidReason: `Facilitator error: ${err.message}`,
    };
  }
}
