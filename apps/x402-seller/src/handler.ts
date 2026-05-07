import { buildPaymentSpec } from "./paymentSpec";
import { fetchDefiData } from "./defiData";
import { verifyPayment } from "./facilitator";

const DEMO_MODE = process.env.MOCK_X402 === "true";

// Main handler logic — works for both Lambda@Edge and Express
export async function handleRequest(
  path: string,
  xPaymentHeader: string | undefined,
  log: (msg: string, meta?: any) => void
): Promise<{
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}> {
  const resource = "/data/defi-protocols";

  if (!path.includes("defi-protocols")) {
    return {
      statusCode: 404,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Not found" }),
    };
  }

  // MOCK_X402 mode: skip payment entirely (local dev only)
  if (DEMO_MODE) {
    log("mock_x402_bypass", { path });
    const data = await fetchDefiData();
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "X-Payment-Mode": "mock",
      },
      body: JSON.stringify({ data, source: "DEMO_FIXTURE", paymentMode: "mock" }),
    };
  }

  const paymentSpec = buildPaymentSpec(resource);

  // No payment header — return 402
  if (!xPaymentHeader) {
    log("payment_required", { path });
    return {
      statusCode: 402,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(paymentSpec),
    };
  }

  // Has payment header — verify with facilitator
  log("verifying_payment", { path, headerLength: xPaymentHeader.length });
  const verifyResult = await verifyPayment(xPaymentHeader, paymentSpec);

  if (!verifyResult.isValid) {
    log("payment_invalid", { reason: verifyResult.invalidReason });
    return {
      statusCode: 402,
      headers: {
        "Content-Type": "application/json",
        "X-Payment-Invalid-Reason": verifyResult.invalidReason || "unknown",
      },
      body: JSON.stringify({
        ...paymentSpec,
        error: verifyResult.invalidReason,
      }),
    };
  }

  // Verified — return data
  log("payment_verified", { txHash: verifyResult.txHash });
  const data = await fetchDefiData();
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "X-Payment-Tx-Hash": verifyResult.txHash || "",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify({
      data,
      source: process.env.S3_BUCKET_NAME ? "S3" : "DEMO_FIXTURE",
      txHash: verifyResult.txHash,
    }),
  };
}

// Lambda@Edge handler
export const handler = async (event: any): Promise<any> => {
  const request = event.Records?.[0]?.cf?.request || event;
  const path = request.uri || request.path || "/";
  const xPayment = request.headers?.["x-payment"]?.[0]?.value || request.headers?.["x-payment"];

  const log = (msg: string, meta?: any) =>
    console.log(JSON.stringify({ level: "info", message: msg, ...meta }));

  const result = await handleRequest(path, xPayment, log);

  // Lambda@Edge response format
  return {
    status: String(result.statusCode),
    statusDescription: result.statusCode === 200 ? "OK" : result.statusCode === 402 ? "Payment Required" : "Not Found",
    headers: Object.entries(result.headers).reduce((acc, [k, v]) => ({
      ...acc,
      [k.toLowerCase()]: [{ key: k, value: v }],
    }), {}),
    body: result.body,
  };
};
