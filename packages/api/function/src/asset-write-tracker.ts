import {Injectable} from "@nestjs/common";

export interface RecentWriteKey {
  functionId: string;
  filename: string;
  hash: string;
}

/** How long (ms) a self-write stamp suppresses the change stream reaction. */
const STAMP_TTL_MS = 10_000;

/**
 * Tracks recently self-written asset keys to suppress change-stream echo.
 *
 * Callers stamp a key immediately before writing metadata to MongoDB.
 * The FunctionAssetWatcher checks the stamp before reacting to a change event
 * on this node — skipping reconciliation for writes this node originated.
 */
@Injectable()
export class SelfWriteTracker {
  private recentWrites = new Map<string, number>();

  stamp(write: RecentWriteKey): void {
    const key = this.buildKey(write);
    const expiry = Date.now() + STAMP_TTL_MS;
    this.recentWrites.set(key, expiry);

    // Schedule TTL cleanup.
    setTimeout(() => {
      if ((this.recentWrites.get(key) ?? 0) <= Date.now()) {
        this.recentWrites.delete(key);
      }
    }, STAMP_TTL_MS + 100).unref();
  }

  isSelfWrite(write: RecentWriteKey): boolean {
    const key = this.buildKey(write);
    const expiry = this.recentWrites.get(key);
    if (!expiry) return false;
    if (Date.now() > expiry) {
      this.recentWrites.delete(key);
      return false;
    }
    return true;
  }

  private buildKey(write: RecentWriteKey): string {
    return `${write.functionId}::${write.filename}::${write.hash}`;
  }
}
