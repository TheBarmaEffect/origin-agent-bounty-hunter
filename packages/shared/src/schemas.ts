import { z } from "zod";

export const AgentIdSchema = z.enum(["scout", "drill", "compass", "dice", "dash"]);
export const AlgorithmSchema = z.enum(["BFS", "DFS", "A*", "Monte Carlo", "Greedy"]);
export const ProblemTypeSchema = z.enum([
  "breadth-discovery",
  "depth-investigation",
  "heuristic-structured",
  "probabilistic-search",
  "speed-critical",
  "hybrid",
]);

export const CreateBountySchema = z.object({
  title: z.string().min(10).max(200),
  description: z.string().min(20).max(2000),
  budgetUsdc: z.number().positive().max(100),
  timeLimitSeconds: z.number().int().min(30).max(300),
});

export const DefiProtocolSchema = z.object({
  name: z.string(),
  chain: z.string(),
  category: z.string(),
  tvlUsd: z.number(),
  volume24hUsd: z.number(),
  change24hPct: z.number(),
  riskFlags: z.array(z.string()),
  source: z.enum(["LIVE", "CACHED", "DEMO_FIXTURE"]),
  updatedAt: z.string(),
});

export const ScoreBreakdownSchema = z.object({
  constraintCompliance: z.number().min(0).max(20),
  answerQuality: z.number().min(0).max(20),
  methodologyFit: z.number().min(0).max(18),
  evidenceQuality: z.number().min(0).max(15),
  coverageDepth: z.number().min(0).max(12),
  reasoningClarity: z.number().min(0).max(10),
  speedCostEfficiency: z.number().min(0).max(5),
  total: z.number().min(0).max(100),
});

export const AuditCheckSchema = z.object({
  rule: z.string(),
  passed: z.boolean(),
  detail: z.string(),
});

export type CreateBountyInput = z.infer<typeof CreateBountySchema>;
