import type { DefiProtocol } from "@origin/shared";
import { OriginPaymentClient } from "@origin/payment-client";

const DEMO_MODE = process.env.DEMO_MODE !== "false";
// When set, agents fetch paid data from this x402-gated endpoint (Prompt 1 / CloudFront)
const PAID_DATA_URL = process.env.PAID_DATA_URL || "";

const DEMO_FIXTURE: DefiProtocol[] = [
  { name: "Lido", chain: "Ethereum", category: "Liquid Staking", tvlUsd: 23_000_000_000, volume24hUsd: 45_000_000, change24hPct: 1.2, riskFlags: ["centralization"], source: "DEMO_FIXTURE", updatedAt: "2024-01-15T00:00:00Z" },
  { name: "Aave V3", chain: "Multi", category: "Lending", tvlUsd: 12_500_000_000, volume24hUsd: 320_000_000, change24hPct: -0.8, riskFlags: [], source: "DEMO_FIXTURE", updatedAt: "2024-01-15T00:00:00Z" },
  { name: "Uniswap V3", chain: "Multi", category: "DEX", tvlUsd: 5_800_000_000, volume24hUsd: 1_200_000_000, change24hPct: 2.1, riskFlags: [], source: "DEMO_FIXTURE", updatedAt: "2024-01-15T00:00:00Z" },
  { name: "Curve Finance", chain: "Multi", category: "DEX", tvlUsd: 4_200_000_000, volume24hUsd: 180_000_000, change24hPct: -1.5, riskFlags: ["complexity"], source: "DEMO_FIXTURE", updatedAt: "2024-01-15T00:00:00Z" },
  { name: "MakerDAO", chain: "Ethereum", category: "CDP", tvlUsd: 8_100_000_000, volume24hUsd: 95_000_000, change24hPct: 0.3, riskFlags: ["governance"], source: "DEMO_FIXTURE", updatedAt: "2024-01-15T00:00:00Z" },
  { name: "Compound V3", chain: "Multi", category: "Lending", tvlUsd: 2_100_000_000, volume24hUsd: 75_000_000, change24hPct: 1.8, riskFlags: [], source: "DEMO_FIXTURE", updatedAt: "2024-01-15T00:00:00Z" },
  { name: "Convex Finance", chain: "Ethereum", category: "Yield", tvlUsd: 3_600_000_000, volume24hUsd: 25_000_000, change24hPct: -2.3, riskFlags: ["complexity", "dependency"], source: "DEMO_FIXTURE", updatedAt: "2024-01-15T00:00:00Z" },
  { name: "Rocket Pool", chain: "Ethereum", category: "Liquid Staking", tvlUsd: 3_200_000_000, volume24hUsd: 12_000_000, change24hPct: 0.9, riskFlags: [], source: "DEMO_FIXTURE", updatedAt: "2024-01-15T00:00:00Z" },
  { name: "GMX", chain: "Arbitrum", category: "Derivatives", tvlUsd: 620_000_000, volume24hUsd: 280_000_000, change24hPct: 4.2, riskFlags: ["leverage"], source: "DEMO_FIXTURE", updatedAt: "2024-01-15T00:00:00Z" },
  { name: "dYdX", chain: "Cosmos", category: "Derivatives", tvlUsd: 420_000_000, volume24hUsd: 450_000_000, change24hPct: 3.1, riskFlags: ["leverage", "counterparty"], source: "DEMO_FIXTURE", updatedAt: "2024-01-15T00:00:00Z" },
  { name: "Balancer", chain: "Multi", category: "DEX", tvlUsd: 850_000_000, volume24hUsd: 95_000_000, change24hPct: -0.5, riskFlags: [], source: "DEMO_FIXTURE", updatedAt: "2024-01-15T00:00:00Z" },
  { name: "Frax Finance", chain: "Multi", category: "Stablecoin", tvlUsd: 750_000_000, volume24hUsd: 30_000_000, change24hPct: -1.1, riskFlags: ["algorithmic"], source: "DEMO_FIXTURE", updatedAt: "2024-01-15T00:00:00Z" },
  { name: "Pendle Finance", chain: "Multi", category: "Yield", tvlUsd: 4_800_000_000, volume24hUsd: 85_000_000, change24hPct: 5.7, riskFlags: ["complexity"], source: "DEMO_FIXTURE", updatedAt: "2024-01-15T00:00:00Z" },
  { name: "EigenLayer", chain: "Ethereum", category: "Restaking", tvlUsd: 11_000_000_000, volume24hUsd: 8_000_000, change24hPct: 2.8, riskFlags: ["new-protocol", "slashing"], source: "DEMO_FIXTURE", updatedAt: "2024-01-15T00:00:00Z" },
  { name: "Ethena", chain: "Ethereum", category: "Stablecoin", tvlUsd: 3_100_000_000, volume24hUsd: 55_000_000, change24hPct: 6.3, riskFlags: ["synthetic", "funding-rate"], source: "DEMO_FIXTURE", updatedAt: "2024-01-15T00:00:00Z" },
];

let cachedProtocols: DefiProtocol[] | null = null;
let cacheSource: "LIVE" | "CACHED" | "DEMO_FIXTURE" = "DEMO_FIXTURE";

export async function getDefiProtocols(bountyId?: string): Promise<DefiProtocol[]> {
  if (DEMO_MODE) {
    return DEMO_FIXTURE;
  }

  // Use x402 paid endpoint if configured
  if (PAID_DATA_URL) {
    return fetchViaX402(bountyId);
  }

  // Try to use cached data first
  if (cachedProtocols) {
    return cachedProtocols.map((p) => ({ ...p, source: "CACHED" as const }));
  }

  // Try to fetch live data from DefiLlama
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch("https://api.llama.fi/protocols", {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) throw new Error(`DefiLlama responded with ${response.status}`);

    const data = await response.json() as Array<{
      name: string;
      chain: string;
      category: string;
      tvl: number;
      volume24h?: number;
      change_1d?: number;
      listedAt?: number;
    }>;

    // Map to our DefiProtocol shape, take top 20 by TVL
    const protocols: DefiProtocol[] = data
      .filter((p) => typeof p.tvl === "number" && p.tvl > 0)
      .sort((a, b) => b.tvl - a.tvl)
      .slice(0, 20)
      .map((p) => ({
        name: p.name,
        chain: p.chain || "Multi",
        category: p.category || "Unknown",
        tvlUsd: p.tvl,
        volume24hUsd: p.volume24h ?? 0,
        change24hPct: p.change_1d ?? 0,
        riskFlags: [],
        source: "LIVE" as const,
        updatedAt: new Date().toISOString(),
      }));

    cachedProtocols = protocols;
    cacheSource = "LIVE";
    console.log(`[defiData] fetched ${protocols.length} protocols from DefiLlama (LIVE)`);
    return protocols;
  } catch (err) {
    console.warn("[defiData] failed to fetch from DefiLlama, falling back to fixture", err);
    // Return fixture data marked as DEMO_FIXTURE on failure
    return DEMO_FIXTURE;
  }
}

/**
 * Fetch DeFi protocol data from the x402-gated endpoint (Prompt 1 CloudFront).
 * Uses a dedicated "optimus" payment client with budget drawn from OPTIMUS_DATA_BUDGET_USDC.
 * Falls back to DEMO_FIXTURE if payment fails.
 */
async function fetchViaX402(bountyId?: string): Promise<DefiProtocol[]> {
  const budget = Number(process.env.OPTIMUS_DATA_BUDGET_USDC || "0.01");
  const client = new OriginPaymentClient("optimus", budget);

  try {
    const result = await client.fetch<Array<{
      protocol: string;
      tvl: number;
      volume24h: number;
      apy: number;
    }>>(PAID_DATA_URL);

    const protocols: DefiProtocol[] = result.data.map((p) => ({
      name: p.protocol,
      chain: "Multi",
      category: "DeFi",
      tvlUsd: p.tvl,
      volume24hUsd: p.volume24h,
      change24hPct: 0,
      riskFlags: [],
      source: "LIVE" as const,
      updatedAt: new Date().toISOString(),
    }));

    console.log(JSON.stringify({
      level: "info",
      timestamp: new Date().toISOString(),
      message: "[defiData] fetched via x402 payment",
      bountyId,
      protocolCount: protocols.length,
      amountPaid: result.amountPaid,
      txHash: result.receipt.txHash,
    }));

    return protocols;
  } catch (err) {
    console.warn(JSON.stringify({
      level: "warn",
      timestamp: new Date().toISOString(),
      message: "[defiData] x402 fetch failed, falling back to fixture",
      bountyId,
      error: (err as Error).message,
    }));
    return DEMO_FIXTURE;
  }
}

export { DEMO_FIXTURE, cacheSource };
