import {Injectable, OnModuleInit, OnModuleDestroy} from "@nestjs/common";
import {UserConfigService} from "./config.service.js";
import {RateLimitConfig, RateLimitGroupConfig} from "@spica-server/interface/passport/user";
import {Subscription} from "rxjs";

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

@Injectable()
export class RateLimitService implements OnModuleInit, OnModuleDestroy {
  private configCache: RateLimitConfig | undefined;
  private readonly tracker = new Map<string, TrackerEntry>();
  private cleanupInterval: ReturnType<typeof setInterval>;
  private watchSubscription: Subscription;

  constructor(private readonly userConfigService: UserConfigService) {}

  async onModuleInit() {
    this.configCache = await this.userConfigService.getRateLimitConfig();

    this.watchSubscription = this.userConfigService.watchConfig().subscribe(options => {
      this.configCache = options?.rateLimits;
    });

    this.cleanupInterval = setInterval(() => this.cleanup(), 60_000);
  }

  onModuleDestroy() {
    if (this.watchSubscription) {
      this.watchSubscription.unsubscribe();
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  getGroupConfig(group: string): RateLimitGroupConfig | undefined {
    if (!this.configCache) {
      return undefined;
    }
    return this.configCache[group];
  }

  checkLimit(group: string, ip: string): RateLimitCheckResult {
    const groupConfig = this.getGroupConfig(group);

    if (!groupConfig) {
      return {allowed: true, limit: 0, remaining: 0, resetAt: 0};
    }

    const {limit, ttl} = groupConfig;
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

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.tracker) {
      if (entry.resetAt <= now) {
        this.tracker.delete(key);
      }
    }
  }

  resetTracker() {
    this.tracker.clear();
  }

  setConfigCache(config: RateLimitConfig | undefined) {
    this.configCache = config;
  }
}
