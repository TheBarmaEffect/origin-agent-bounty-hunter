import { Router, Request, Response } from "express";
import { storage } from "../storage";

export const strategyStatsRouter = Router();

// GET /api/strategy-stats
strategyStatsRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const stats = await storage.getAllStrategyStats();
    res.json({ stats });
  } catch (err) {
    console.error("[strategy-stats] error", err);
    res.status(500).json({ error: "Failed to get strategy stats" });
  }
});
