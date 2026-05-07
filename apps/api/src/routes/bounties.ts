import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { CreateBountySchema } from "@origin/shared";
import type { Bounty } from "@origin/shared";
import { storage } from "../storage";
import { raceStream } from "../sse/raceStream";
import { runRace } from "../services/raceEngine";
import { getX402Adapter } from "../payments/x402Adapter";
import { replayBounty } from "../replay/replayEngine";

const DEMO_MODE = process.env.DEMO_MODE !== "false";

export const bountiesRouter = Router();

// POST /api/bounties — create bounty
bountiesRouter.post("/", async (req: Request, res: Response) => {
  try {
    const parsed = CreateBountySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    const { title, description, budgetUsdc, timeLimitSeconds } = parsed.data;

    const bounty: Bounty = {
      id: uuidv4(),
      title,
      description,
      budgetUsdc,
      timeLimitSeconds,
      status: "created",
      paymentStatus: "unpaid",
      createdAt: new Date().toISOString(),
    };

    await storage.saveBounty(bounty);

    if (!DEMO_MODE) {
      // Trigger x402 payment challenge
      const x402 = getX402Adapter();
      const challenge = await x402.createChallenge(
        budgetUsdc.toFixed(2),
        `Bounty: ${title}`
      );
      res.status(402).json({
        bounty,
        paymentRequired: true,
        challenge,
      });
      return;
    }

    res.status(201).json({ bounty, paymentRequired: false, demoMode: true });
  } catch (err) {
    console.error("[bounties] create error", err);
    res.status(500).json({ error: "Failed to create bounty" });
  }
});

// GET /api/bounties/:id
bountiesRouter.get("/:id", async (req: Request, res: Response) => {
  try {
    const bounty = await storage.getBounty(req.params.id);
    if (!bounty) {
      res.status(404).json({ error: "Bounty not found" });
      return;
    }
    res.json({ bounty });
  } catch (err) {
    console.error("[bounties] get error", err);
    res.status(500).json({ error: "Failed to get bounty" });
  }
});

// POST /api/bounties/:id/start — start the race
bountiesRouter.post("/:id/start", async (req: Request, res: Response) => {
  try {
    const bounty = await storage.getBounty(req.params.id);
    if (!bounty) {
      res.status(404).json({ error: "Bounty not found" });
      return;
    }
    if (bounty.status !== "created") {
      res.status(409).json({ error: "Bounty already started", status: bounty.status });
      return;
    }

    // Update status
    bounty.status = "running";
    await storage.saveBounty(bounty);

    // Kick off race asynchronously
    runRace(req.params.id).catch((err) => {
      console.error("[bounties] race error", err);
    });

    res.json({ started: true, bountyId: req.params.id });
  } catch (err) {
    console.error("[bounties] start error", err);
    res.status(500).json({ error: "Failed to start race" });
  }
});

// GET /api/bounties/:id/events — SSE stream
bountiesRouter.get("/:id/events", (req: Request, res: Response) => {
  const bountyId = req.params.id;
  raceStream.subscribe(bountyId, res);
});

// GET /api/bounties/:id/verdict
bountiesRouter.get("/:id/verdict", async (req: Request, res: Response) => {
  try {
    const verdict = await storage.getVerdict(req.params.id);
    if (!verdict) {
      res.status(404).json({ error: "Verdict not yet available" });
      return;
    }
    res.json({ verdict });
  } catch (err) {
    console.error("[bounties] verdict error", err);
    res.status(500).json({ error: "Failed to get verdict" });
  }
});

// POST /api/bounties/:id/replay — trigger replay
bountiesRouter.post("/:id/replay", async (req: Request, res: Response) => {
  try {
    const bountyId = req.params.id;
    const events = await storage.getReplayEvents(bountyId);
    if (events.length === 0) {
      res.status(404).json({ error: "No replay events found for this bounty" });
      return;
    }

    // Run replay asynchronously, emitting events to SSE subscribers
    replayBounty(bountyId, (event) => {
      raceStream.emit(bountyId, event);
    }).catch((err) => {
      console.error("[replay] error", err);
    });

    res.json({ replaying: true, bountyId, eventCount: events.length });
  } catch (err) {
    console.error("[bounties] replay error", err);
    res.status(500).json({ error: "Failed to start replay" });
  }
});
