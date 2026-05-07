import express from "express";
import cors from "cors";
import { bountiesRouter } from "./routes/bounties";
import { strategyStatsRouter } from "./routes/strategyStats";
import { paidDataRouter } from "./routes/paidData";
import { healthRouter } from "./routes/health";
import { devRouter } from "./routes/dev";

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const DEMO_MODE = process.env.DEMO_MODE !== "false";

function log(level: "info" | "warn" | "error", message: string, meta?: Record<string, unknown>) {
  const entry = {
    level,
    timestamp: new Date().toISOString(),
    message,
    ...meta,
  };
  if (level === "error") {
    console.error(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());

// Request logger
app.use((req, _res, next) => {
  log("info", "incoming request", { method: req.method, path: req.path });
  next();
});

// Mount routes
app.use("/api/bounties", bountiesRouter);
app.use("/api/strategy-stats", strategyStatsRouter);
app.use("/paid-data", paidDataRouter);
app.use("/api/health", healthRouter);
app.use("/api/dev", devRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  log("error", "unhandled error", { error: err.message, stack: err.stack });
  res.status(500).json({ error: "Internal server error" });
});

const server = app.listen(PORT, () => {
  log("info", "server started", { port: PORT, demoMode: DEMO_MODE });
});

// Graceful shutdown
function shutdown(signal: string) {
  log("info", "shutting down", { signal });
  server.close(() => {
    log("info", "server closed");
    process.exit(0);
  });
  setTimeout(() => {
    log("warn", "forcing shutdown after timeout");
    process.exit(1);
  }, 5000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Don't let unhandled rejections from background tasks (CDP payments etc.) kill
// the server during a live demo. Log loudly but stay alive.
process.on("unhandledRejection", (reason) => {
  log("error", "unhandled rejection (non-fatal)", {
    error: (reason as Error)?.message ?? String(reason),
    stack: (reason as Error)?.stack,
  });
});
process.on("uncaughtException", (err) => {
  log("error", "uncaught exception (non-fatal)", { error: err.message, stack: err.stack });
});

export { app };
