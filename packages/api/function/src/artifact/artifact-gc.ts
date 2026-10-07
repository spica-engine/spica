import {Injectable, Logger, OnModuleDestroy, OnModuleInit} from "@nestjs/common";
import {ArtifactStore} from "./artifact-store.js";
import {ArtifactWorkspace} from "./artifact-workspace.js";

const GRACE_MS = 24 * 60 * 60 * 1000;
const INITIAL_DELAY_MS = 5 * 60 * 1000;
const INTERVAL_MS = 6 * 60 * 60 * 1000;

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

@Injectable()
export class ArtifactGarbageCollector implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ArtifactGarbageCollector.name);
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly store: ArtifactStore,
    private readonly workspace: ArtifactWorkspace
  ) {}

  onModuleInit() {
    this.schedule(INITIAL_DELAY_MS + Math.floor(Math.random() * INITIAL_DELAY_MS));
  }

  onModuleDestroy() {
    clearTimeout(this.timer);
  }

  async collect(now = Date.now()): Promise<void> {
    const unreferenced = await this.store.findUnreferenced(now - GRACE_MS);
    for (const key of unreferenced) {
      await this.store
        .delete(key)
        .catch(e => this.logger.error(`[artifact] Could not delete ${key}: ${errMsg(e)}`));
    }
    if (unreferenced.length) {
      this.logger.log(`[artifact] Deleted ${unreferenced.length} unreferenced archive(s)`);
    }
    await this.workspace.prune(now);
  }

  private schedule(delay: number) {
    this.timer = setTimeout(() => this.run(), delay);
    this.timer.unref();
  }

  private run() {
    this.collect()
      .catch(e => this.logger.error(`[artifact] Garbage collection failed: ${errMsg(e)}`))
      .finally(() => this.schedule(INTERVAL_MS));
  }
}
