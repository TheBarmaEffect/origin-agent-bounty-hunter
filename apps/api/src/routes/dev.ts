import { Router, Request, Response } from "express";
import { storage } from "../storage";

const DEMO_MODE = process.env.DEMO_MODE !== "false";

export const devRouter = Router();

// POST /api/dev/reset — clears local storage (demo only)
devRouter.post("/reset", async (_req: Request, res: Response) => {
  if (!DEMO_MODE) {
    res.status(403).json({ error: "Reset only available in DEMO_MODE" });
    return;
  }

  try {
    if ("reset" in storage && typeof (storage as { reset?: () => void }).reset === "function") {
      (storage as { reset: () => void }).reset();
    }
    res.json({ reset: true, message: "Local storage cleared" });
  } catch (err) {
    console.error("[dev] reset error", err);
    res.status(500).json({ error: "Failed to reset storage" });
  }
});
