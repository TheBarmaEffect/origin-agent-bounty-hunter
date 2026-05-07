import { Response } from "express";
import type { SSEEvent } from "@origin/shared";

class RaceStream {
  private subscribers: Map<string, Response[]> = new Map();
  private eventBuffers: Map<string, SSEEvent[]> = new Map();

  subscribe(bountyId: string, res: Response): void {
    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    // Send a comment to establish connection
    res.write(": connected\n\n");

    // Register subscriber
    if (!this.subscribers.has(bountyId)) {
      this.subscribers.set(bountyId, []);
    }
    this.subscribers.get(bountyId)!.push(res);

    // Replay buffered events for late subscribers
    const buffered = this.eventBuffers.get(bountyId) || [];
    for (const event of buffered) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }

    // Handle client disconnect
    req_cleanup: {
      const cleanup = () => {
        const subs = this.subscribers.get(bountyId) || [];
        const idx = subs.indexOf(res);
        if (idx !== -1) subs.splice(idx, 1);
        if (subs.length === 0) {
          // Keep the buffer but remove subscriber list entry
          this.subscribers.delete(bountyId);
        }
      };

      res.on("close", cleanup);
      res.on("finish", cleanup);
      res.on("error", cleanup);
      break req_cleanup;
    }
  }

  emit(bountyId: string, event: SSEEvent): void {
    const data = `data: ${JSON.stringify(event)}\n\n`;

    // Buffer event for replay / late subscribers
    if (!this.eventBuffers.has(bountyId)) {
      this.eventBuffers.set(bountyId, []);
    }
    this.eventBuffers.get(bountyId)!.push(event);

    // Send to all current subscribers
    const subs = this.subscribers.get(bountyId) || [];
    for (const res of subs) {
      try {
        res.write(data);
      } catch (_err) {
        // Subscriber disconnected
      }
    }
  }

  close(bountyId: string): void {
    const subs = this.subscribers.get(bountyId) || [];
    for (const res of subs) {
      try {
        res.end();
      } catch (_err) {
        // Already closed
      }
    }
    this.subscribers.delete(bountyId);
  }

  getBuffer(bountyId: string): SSEEvent[] {
    return this.eventBuffers.get(bountyId) || [];
  }

  clearBuffer(bountyId: string): void {
    this.eventBuffers.delete(bountyId);
  }
}

export const raceStream = new RaceStream();
