import express from "express";
import { handleRequest } from "./handler";

const app = express();
const PORT = process.env.PORT || 3002;

app.get("/data/defi-protocols", async (req, res) => {
  const log = (msg: string, meta?: any) =>
    console.log(JSON.stringify({ level: "info", message: msg, path: req.path, ...meta }));

  const result = await handleRequest(
    req.path,
    req.headers["x-payment"] as string | undefined,
    log
  );

  res.status(result.statusCode);
  Object.entries(result.headers).forEach(([k, v]) => res.setHeader(k, v));
  res.send(result.body);
});

app.get("/health", (_req, res) => res.json({ status: "ok", mockMode: process.env.MOCK_X402 === "true" }));

app.listen(PORT, () => {
  console.log(JSON.stringify({
    level: "info",
    message: "x402-seller server started",
    port: PORT,
    mockMode: process.env.MOCK_X402 === "true"
  }));
});
