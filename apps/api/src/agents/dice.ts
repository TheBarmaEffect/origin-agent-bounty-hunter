import type { AgentSubmission, DefiProtocol, MonteCarloExecutionLog } from "@origin/shared";
import type { AgentRuntime } from "./types";

const K_SAMPLES = 12;
const DEMO_DISQUALIFY_AGENT = process.env.DEMO_DISQUALIFY_AGENT;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Linear Congruential Generator — deterministic seeded PRNG */
class LCG {
  private state: number;
  constructor(seed: number) {
    this.state = seed >>> 0;
  }
  next(): number {
    // Parameters from Numerical Recipes
    this.state = ((1664525 * this.state + 1013904223) >>> 0);
    return this.state / 0xffffffff;
  }
  nextInt(max: number): number {
    return Math.floor(this.next() * max);
  }
}

function bountyIdToSeed(bountyId: string): number {
  let hash = 0;
  for (let i = 0; i < Math.min(bountyId.length, 8); i++) {
    hash = (hash * 31 + bountyId.charCodeAt(i)) >>> 0;
  }
  return hash || 42;
}

export const dice: AgentRuntime = {
  agentId: "dice",
  algorithm: "Monte Carlo",

  async run(
    bountyId: string,
    protocols: DefiProtocol[],
    _timeLimitMs: number,
    emitProgress: (step: string, detail: string, progress: number) => void
  ): Promise<AgentSubmission> {
    const startMs = Date.now();
    const reasoningTrace: string[] = [];

    // Deterministic seed from bountyId
    const seedValue = bountyIdToSeed(bountyId);
    const seed = `lcg-${seedValue}`;
    const rng = new LCG(seedValue);

    emitProgress("Initializing Monte Carlo sampler", `Seed: ${seed}, K=${K_SAMPLES} samples`, 5);
    reasoningTrace.push(`Monte Carlo init: seed=${seed}, K=${K_SAMPLES}, protocols=${protocols.length}`);
    await delay(2000);

    // Sample K protocols randomly using seeded PRNG (no Math.random)
    const sampledIndices = new Set<number>();
    const sampledCandidates: string[] = [];

    let sampleCount = 0;
    let actualK = K_SAMPLES;

    if (DEMO_DISQUALIFY_AGENT === "dice") {
      actualK = 5; // Below minimum of 10 — triggers disqualification
      reasoningTrace.push("[DEMO] Forcing sampleCount=5 for disqualification demo");
    }

    while (sampledCandidates.length < actualK && sampledCandidates.length < protocols.length) {
      const idx = rng.nextInt(protocols.length);
      if (!sampledIndices.has(idx)) {
        sampledIndices.add(idx);
        sampledCandidates.push(protocols[idx].name);
        sampleCount++;

        emitProgress(
          `Sampling candidate ${sampleCount}/${actualK}`,
          `Selected: ${protocols[idx].name}`,
          10 + sampleCount * 5
        );
        reasoningTrace.push(`Sample ${sampleCount}: ${protocols[idx].name}`);
        await delay(1500);
      }
    }

    emitProgress("Running Monte Carlo scoring", "Computing mean and variance across samples", 75);
    reasoningTrace.push("Computing score distribution over sampled candidates");
    await delay(3000);

    // Score each sampled candidate with slight random noise
    const maxTvl = Math.max(...protocols.map((p) => p.tvlUsd));
    const maxVol = Math.max(...protocols.map((p) => p.volume24hUsd));

    const scoredSamples = sampledCandidates.map((name) => {
      const p = protocols.find((pr) => pr.name === name)!;
      const base =
        (p.tvlUsd / maxTvl) * 0.5 +
        (p.volume24hUsd / maxVol) * 0.3 +
        (Math.max(0, p.change24hPct) / 10) * 0.2 -
        p.riskFlags.length * 0.08;
      // Add small noise via RNG
      const noise = (rng.next() - 0.5) * 0.05;
      return { name, score: Math.max(0, base + noise), protocol: p };
    });

    // Compute mean and variance
    const scores = scoredSamples.map((s) => s.score);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance =
      scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);

    const confidenceInterval: [number, number] = [
      parseFloat((mean - 1.96 * stdDev).toFixed(4)),
      parseFloat((mean + 1.96 * stdDev).toFixed(4)),
    ];

    emitProgress("Monte Carlo complete — selecting top 3", `Mean: ${mean.toFixed(4)}, Variance: ${variance.toFixed(4)}`, 90);
    reasoningTrace.push(`MC stats: mean=${mean.toFixed(4)}, variance=${variance.toFixed(4)}, CI=[${confidenceInterval[0]}, ${confidenceInterval[1]}]`);
    await delay(2000);

    const top3 = [...scoredSamples].sort((a, b) => b.score - a.score).slice(0, 3);
    const submittedAtMs = Date.now() - startMs;

    const executionLog: MonteCarloExecutionLog = {
      agentId: "dice",
      algorithm: "Monte Carlo",
      seed,
      sampleCount,
      sampledCandidates,
      varianceEstimate: parseFloat(variance.toFixed(6)),
      confidenceInterval,
    };

    const submission: AgentSubmission = {
      bountyId,
      agentId: "dice",
      algorithm: "Monte Carlo",
      answer: {
        topProtocols: top3.map((t, i) => ({
          rank: i + 1,
          name: t.name,
          chain: t.protocol.chain,
          tvlUsd: t.protocol.tvlUsd,
          volume24hUsd: t.protocol.volume24hUsd,
          riskAdjustedScore: parseFloat(t.score.toFixed(4)),
          recommendation: `Monte Carlo sampling selected ${t.name} with score ${t.score.toFixed(4)} (CI: [${confidenceInterval[0]}, ${confidenceInterval[1]}]). Seeded random sampling ensures reproducibility.`,
        })),
        summary: `Dice ran ${sampleCount} Monte Carlo samples (seed: ${seed}) across ${protocols.length} DeFi protocols. The LCG-seeded sampler selected ${sampledCandidates.length} unique candidates. Mean score: ${mean.toFixed(4)}, variance: ${variance.toFixed(6)}, 95% CI: [${confidenceInterval[0]}, ${confidenceInterval[1]}].`,
        methodology: `Monte Carlo sampling: LCG PRNG seeded from bountyId (seed=${seedValue}). K=${sampleCount} unique candidates sampled. Scoring: (tvl/max)*0.5 + (vol/max)*0.3 + (momentum/10)*0.2 - riskFlags*0.08 + noise~U(-0.025, 0.025). Statistics computed over sample distribution.`,
        confidence: parseFloat((1 - Math.sqrt(variance)).toFixed(3)),
      },
      reasoningTrace,
      executionLog,
      status: "submitted",
      submittedAtMs,
      disqualified: false,
    };

    return submission;
  },
};
