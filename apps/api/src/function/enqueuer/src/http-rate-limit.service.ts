interface TrackerEntry {
  count: number;
  resetAt: number;
}

export interface RateLimitCheckResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

export interface RateLimitConfig {
  limit: number;
  ttl: number;
}

export class HttpRateLimitService {
  private readonly configs = new Map<string, RateLimitConfig>();
  private readonly tracker = new Map<string, TrackerEntry>();
  private readonly cleanupInterval: ReturnType<typeof setInterval>;

  constructor(cleanupIntervalMs: number = 60_000) {
    this.cleanupInterval = setInterval(() => this.cleanup(), cleanupIntervalMs);
    // Allow the process to exit even if this interval is still active (when supported by the timer implementation)
    (this.cleanupInterval as any).unref?.();
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
  }

  addLimit(group: string, config: RateLimitConfig): void {
    this.configs.set(group, config);
  }

  removeLimit(group: string): void {
    this.configs.delete(group);

    const prefix = `${group}:`;
    for (const key of this.tracker.keys()) {
      if (key.startsWith(prefix)) {
        this.tracker.delete(key);
      }
    }
  }

  checkLimit(group: string, ip: string): RateLimitCheckResult {
    const config = this.configs.get(group);

    if (!config) {
      return {allowed: true, limit: 0, remaining: 0, resetAt: 0};
    }

    const {limit, ttl} = config;
    const key = `${group}:${ip}`;
    const now = Date.now();
    let entry = this.tracker.get(key);

    if (!entry || entry.resetAt <= now) {
      entry = {count: 1, resetAt: now + ttl};
      this.tracker.set(key, entry);
      return {allowed: true, limit, remaining: limit - 1, resetAt: entry.resetAt};
    }

    entry.count++;
    const allowed = entry.count <= limit;
    const remaining = Math.max(0, limit - entry.count);

    return {allowed, limit, remaining, resetAt: entry.resetAt};
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.tracker) {
      if (entry.resetAt <= now) {
        this.tracker.delete(key);
      }
    }
  }

  resetTracker(): void {
    this.tracker.clear();
  }
}
