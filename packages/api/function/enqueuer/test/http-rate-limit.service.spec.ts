import {HttpRateLimitService} from "@spica-server/function-enqueuer";

describe("HttpRateLimitService", () => {
  let service: HttpRateLimitService;

  beforeEach(() => {
    service = new HttpRateLimitService();
  });

  afterEach(() => {
    service.destroy();
    jest.useRealTimers();
  });

  describe("when no rate limit config exists", () => {
    it("should allow all requests", () => {
      const result = service.checkLimit("fn1:default", "192.168.1.1");
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(0);
      expect(result.remaining).toBe(0);
      expect(result.resetAt).toBe(0);
    });
  });

  describe("when rate limit config is set", () => {
    beforeEach(() => {
      service.addLimit("fn1:default", {limit: 3, ttl: 60_000});
    });

    it("should allow requests within the limit", () => {
      const result1 = service.checkLimit("fn1:default", "192.168.1.1");
      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(2);

      const result2 = service.checkLimit("fn1:default", "192.168.1.1");
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(1);

      const result3 = service.checkLimit("fn1:default", "192.168.1.1");
      expect(result3.allowed).toBe(true);
      expect(result3.remaining).toBe(0);
    });

    it("should reject requests exceeding the limit", () => {
      service.checkLimit("fn1:default", "192.168.1.1");
      service.checkLimit("fn1:default", "192.168.1.1");
      service.checkLimit("fn1:default", "192.168.1.1");

      const result = service.checkLimit("fn1:default", "192.168.1.1");
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it("should track different IPs independently", () => {
      service.checkLimit("fn1:default", "192.168.1.1");
      service.checkLimit("fn1:default", "192.168.1.1");
      service.checkLimit("fn1:default", "192.168.1.1");
      const resultIp1 = service.checkLimit("fn1:default", "192.168.1.1");
      expect(resultIp1.allowed).toBe(false);

      const resultIp2 = service.checkLimit("fn1:default", "10.0.0.1");
      expect(resultIp2.allowed).toBe(true);
      expect(resultIp2.remaining).toBe(2);
    });

    it("should track different groups independently", () => {
      service.addLimit("fn2:handler", {limit: 5, ttl: 60_000});

      service.checkLimit("fn1:default", "192.168.1.1");
      service.checkLimit("fn1:default", "192.168.1.1");
      service.checkLimit("fn1:default", "192.168.1.1");
      const fn1Result = service.checkLimit("fn1:default", "192.168.1.1");
      expect(fn1Result.allowed).toBe(false);

      const fn2Result = service.checkLimit("fn2:handler", "192.168.1.1");
      expect(fn2Result.allowed).toBe(true);
      expect(fn2Result.remaining).toBe(4);
    });

    it("should return correct limit and resetAt values", () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      const now = Date.now();

      const result = service.checkLimit("fn1:default", "192.168.1.1");

      expect(result.limit).toBe(3);
      expect(result.resetAt).toBe(now + 60_000);
    });

    it("should reset counter after TTL window expires", () => {
      jest.useFakeTimers();

      service.checkLimit("fn1:default", "192.168.1.1");
      service.checkLimit("fn1:default", "192.168.1.1");
      service.checkLimit("fn1:default", "192.168.1.1");
      const blocked = service.checkLimit("fn1:default", "192.168.1.1");
      expect(blocked.allowed).toBe(false);

      jest.advanceTimersByTime(60_000);

      const afterReset = service.checkLimit("fn1:default", "192.168.1.1");
      expect(afterReset.allowed).toBe(true);
      expect(afterReset.remaining).toBe(2);
    });
  });

  describe("addLimit", () => {
    it("should register a new rate limit config", () => {
      service.addLimit("fn1:default", {limit: 10, ttl: 30_000});

      const result = service.checkLimit("fn1:default", "1.1.1.1");
      expect(result.limit).toBe(10);
      expect(result.remaining).toBe(9);
    });

    it("should overwrite existing config", () => {
      service.addLimit("fn1:default", {limit: 2, ttl: 60_000});
      service.checkLimit("fn1:default", "1.1.1.1");
      service.checkLimit("fn1:default", "1.1.1.1");
      const blocked = service.checkLimit("fn1:default", "1.1.1.1");
      expect(blocked.allowed).toBe(false);

      service.addLimit("fn1:default", {limit: 10, ttl: 60_000});
      const result = service.checkLimit("fn1:default", "1.1.1.1");
      expect(result.limit).toBe(10);
    });
  });

  describe("removeLimit", () => {
    it("should remove config and tracker entries for the group", () => {
      service.addLimit("fn1:default", {limit: 3, ttl: 60_000});
      service.checkLimit("fn1:default", "192.168.1.1");
      service.checkLimit("fn1:default", "192.168.1.1");

      service.removeLimit("fn1:default");

      const result = service.checkLimit("fn1:default", "192.168.1.1");
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(0);
    });

    it("should not affect other groups", () => {
      service.addLimit("fn1:default", {limit: 3, ttl: 60_000});
      service.addLimit("fn2:handler", {limit: 5, ttl: 60_000});
      service.checkLimit("fn2:handler", "192.168.1.1");

      service.removeLimit("fn1:default");

      const result = service.checkLimit("fn2:handler", "192.168.1.1");
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(5);
      expect(result.remaining).toBe(3);
    });
  });

  describe("resetTracker", () => {
    it("should clear all tracking data but keep configs", () => {
      service.addLimit("fn1:default", {limit: 2, ttl: 60_000});
      service.checkLimit("fn1:default", "1.1.1.1");
      service.checkLimit("fn1:default", "1.1.1.1");

      service.resetTracker();

      const result = service.checkLimit("fn1:default", "1.1.1.1");
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1);
    });
  });

  describe("periodic cleanup", () => {
    it("should remove expired tracker entries on cleanup interval", () => {
      jest.useFakeTimers();
      service.destroy();
      service = new HttpRateLimitService(1_000);

      service.addLimit("fn1:default", {limit: 3, ttl: 5_000});
      service.checkLimit("fn1:default", "192.168.1.1");
      service.checkLimit("fn1:default", "10.0.0.1");

      // Advance past the TTL so both entries expire, then trigger cleanup
      jest.advanceTimersByTime(6_000);

      // After cleanup, a new request should start a fresh window with full remaining count
      const result = service.checkLimit("fn1:default", "192.168.1.1");
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
    });
  });
});
