import { Router, Request, Response } from "express";
import { getDefiProtocols } from "../data/defiData";
import { getX402Adapter } from "../payments/x402Adapter";
import { v4 as uuidv4 } from "uuid";

const DEMO_MODE = process.env.DEMO_MODE !== "false";

export const paidDataRouter = Router();

// GET /paid-data/defi/protocols — x402-gated endpoint
paidDataRouter.get("/defi/protocols", async (req: Request, res: Response) => {
  const paymentHeader = req.headers["x-payment"] as string | undefined;

  if (DEMO_MODE) {
    // In demo mode: check for X-PAYMENT header
    if (!paymentHeader) {
      const paymentInfo = {
        version: "0.1.0",
        scheme: "exact",
        network: "eip155:84532",
        maxAmountRequired: "1000000", // 1 USDC in base units (6 decimals)
        resource: `${req.protocol}://${req.get("host")}${req.originalUrl}`,
        description: "Access to live DeFi protocol TVL data",
        mimeType: "application/json",
        payTo: process.env.PAYMENT_ADDRESS || "0x0000000000000000000000000000000000000001",
        maxTimeoutSeconds: 300,
        asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // USDC on Base Sepolia
        extra: {
          name: "USDC",
          version: "2",
        },
      };

      res.setHeader("X-PAYMENT-RESPONSE", JSON.stringify({
        id: uuidv4(),
        ...paymentInfo,
      }));
      res.status(402).json({
        error: "Payment Required",
        paymentInfo,
        hint: "Include X-Payment header with a signed payment to access this data",
        demoHint: "In demo mode, include any X-Payment header to bypass payment verification",
      });
      return;
    }

    // Payment header present — return data
    try {
      const protocols = await getDefiProtocols();
      res.json({
        protocols,
        paymentVerified: true,
        demoMode: true,
        count: protocols.length,
      });
    } catch (err) {
      console.error("[paid-data] error fetching protocols", err);
      res.status(500).json({ error: "Failed to fetch DeFi data" });
    }
    return;
  }

  // Real mode: verify x402 payment properly
  const x402 = getX402Adapter();
  if (!paymentHeader) {
    res.status(402).json({ error: "Payment Required", hint: "Include X-Payment header" });
    return;
  }

  try {
    // In real mode we'd have a stored challenge — use a placeholder challenge for verification
    const challenge = await x402.createChallenge("1.00", "DeFi protocol data access");
    const verified = await x402.verifyPayment(paymentHeader, challenge);
    if (!verified) {
      res.status(402).json({ error: "Invalid payment" });
      return;
    }

    const protocols = await getDefiProtocols();
    res.json({ protocols, paymentVerified: true, demoMode: false, count: protocols.length });
  } catch (err) {
    console.error("[paid-data] real mode error", err);
    res.status(500).json({ error: "Payment verification failed" });
  }
});
