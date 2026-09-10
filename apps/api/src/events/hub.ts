import type { StatusChange } from "@boltbounty/shared";
import { EventEmitter } from "node:events";

// In-process fan-out of status changes to SSE subscribers.
export class Hub {
  private emitter = new EventEmitter();

  publish(change: StatusChange): void {
    this.emitter.emit("change", change);
  }

  subscribe(listener: (change: StatusChange) => void): () => void {
    this.emitter.on("change", listener);
    return () => this.emitter.off("change", listener);
  }
}
