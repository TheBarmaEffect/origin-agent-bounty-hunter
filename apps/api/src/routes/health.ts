import { Router, Request, Response } from "express";

const DEMO_MODE = process.env.DEMO_MODE !== "false";

export const healthRouter = Router();

// GET /api/health
healthRouter.get("/", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    demoMode: DEMO_MODE,
    timestamp: new Date().toISOString(),
  });
});
