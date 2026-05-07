import { createHash } from "crypto";
import type { Verdict } from "@origin/shared";

export function hashVerdict(verdict: Verdict): string {
  // Canonicalize JSON (sorted keys), then SHA-256
  const canonical = JSON.stringify(verdict, Object.keys(verdict).sort());
  return createHash("sha256").update(canonical).digest("hex");
}
