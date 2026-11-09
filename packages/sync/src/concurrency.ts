import {SyncHttpClient} from "./http";
import {DEFAULT_CONCURRENCY} from "./types";

const REQUEST_METHODS = ["get", "delete", "head", "post", "patch", "put"] as const;

interface LimitedClient {
  semaphore: Semaphore;
  target: SyncHttpClient;
}

const limitedClients = new WeakMap<object, LimitedClient>();

export function limitConcurrency<T extends SyncHttpClient>(
  http: T,
  limit: number = DEFAULT_CONCURRENCY,
  signal?: AbortSignal
): T {
  const existing = limitedClients.get(http);
  if (existing && !signal) return http;

  const {semaphore, target} = existing ?? {
    semaphore: new Semaphore(normalizeLimit(limit)),
    target: http
  };

  const limited = {...target} as Record<string, unknown>;
  for (const method of REQUEST_METHODS) {
    limited[method] = (...args: unknown[]) =>
      semaphore.run(() => {
        if (signal?.aborted) throw signal.reason;
        return (target[method] as (...a: unknown[]) => Promise<unknown>)(...args);
      });
  }

  limitedClients.set(limited, {semaphore, target});
  return limited as T;
}

export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  let failure: {error: unknown} | undefined;

  const worker = async () => {
    while (!failure && next < items.length) {
      const index = next++;
      try {
        results[index] = await fn(items[index], index);
      } catch (error) {
        if (!failure) failure = {error};
      }
    }
  };

  const workerCount = Math.min(normalizeLimit(limit), items.length);
  await Promise.all(Array.from({length: workerCount}, worker));

  if (failure) throw failure.error;
  return results;
}

function normalizeLimit(limit: number): number {
  return Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : DEFAULT_CONCURRENCY;
}

class Semaphore {
  private active = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(private readonly limit: number) {}

  async run<R>(task: () => Promise<R>): Promise<R> {
    await this.acquire();
    try {
      return await task();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.active < this.limit) {
      this.active++;
      return Promise.resolve();
    }
    return new Promise(resolve => this.waiting.push(resolve));
  }

  private release(): void {
    const next = this.waiting.shift();
    if (next) {
      next();
    } else {
      this.active--;
    }
  }
}
