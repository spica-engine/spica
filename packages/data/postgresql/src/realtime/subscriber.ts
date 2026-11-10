import {StreamChunk} from "@spica-server/interface-realtime";
import {HubBatch, HubMember} from "./hub.js";
import {Limiter} from "./limiter.js";
import {RealtimeWindow} from "./window.js";

type Chunks = StreamChunk<Record<string, unknown>>[];

export class RealtimeSubscriber implements HubMember {
  private window?: RealtimeWindow;
  private readonly pending: HubBatch[] = [];
  private tail: Promise<void> = Promise.resolve();
  private closed = false;

  constructor(
    private readonly limiter: Limiter,
    private readonly emit: (chunks: Chunks) => void,
    private readonly onError: (error: Error) => void
  ) {}

  async start(window: RealtimeWindow) {
    const chunks = await this.limiter.run(() => window.initial());
    if (this.closed) {
      return;
    }
    this.emit(chunks);
    this.window = window;
    this.pending.splice(0).forEach(batch => this.enqueue(batch));
  }

  deliver(batch: HubBatch) {
    if (this.closed) {
      return;
    }
    if (this.window) {
      this.enqueue(batch);
    } else {
      this.pending.push(batch);
    }
  }

  fail(error: Error) {
    if (!this.closed) {
      this.closed = true;
      this.onError(error);
    }
  }

  close() {
    this.closed = true;
  }

  private enqueue(batch: HubBatch) {
    this.tail = this.tail.then(async () => {
      if (this.closed) {
        return;
      }
      try {
        const chunks = await this.limiter.run(() =>
          this.window!.apply(batch.changes, batch.queries)
        );
        if (!this.closed) {
          this.emit(chunks);
        }
      } catch (error) {
        this.fail(error as Error);
      }
    });
  }
}
