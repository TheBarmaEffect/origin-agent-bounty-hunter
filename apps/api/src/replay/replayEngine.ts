import type { SSEEvent } from "@origin/shared";
import { storage } from "../storage";

const REPLAY_SPEED = 0.5; // 50% speed (2x slower than original)

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function replayBounty(
  bountyId: string,
  emitter: (event: SSEEvent) => void
): Promise<void> {
  const events = await storage.getReplayEvents(bountyId);
  if (events.length === 0) {
    console.warn(`[replay] No events found for bounty ${bountyId}`);
    return;
  }

  console.log(JSON.stringify({
    level: "info",
    timestamp: new Date().toISOString(),
    message: "[replay] starting replay",
    bountyId,
    eventCount: events.length,
  }));

  // Re-emit events with original timing gaps scaled to REPLAY_SPEED
  let prevTimestamp: number | null = null;

  for (const event of events) {
    const eventTime = new Date(event.timestamp).getTime();

    if (prevTimestamp !== null) {
      const gap = eventTime - prevTimestamp;
      const scaledGap = Math.floor(gap * REPLAY_SPEED);
      if (scaledGap > 0 && scaledGap < 10_000) {
        await delay(scaledGap);
      }
    }

    emitter(event);
    prevTimestamp = eventTime;
  }

  // Emit replay.ready at the end
  const replayReadyEvent: SSEEvent = {
    id: `replay-ready-${bountyId}`,
    bountyId,
    type: "replay.ready",
    timestamp: new Date().toISOString(),
    payload: {
      bountyId,
      eventCount: events.length,
    },
  };

  emitter(replayReadyEvent);

  console.log(JSON.stringify({
    level: "info",
    timestamp: new Date().toISOString(),
    message: "[replay] replay complete",
    bountyId,
    eventCount: events.length,
  }));
}
