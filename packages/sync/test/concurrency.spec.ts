import {
  DEFAULT_CONCURRENCY,
  limitConcurrency,
  mapWithConcurrency,
  SyncHttpClient
} from "@spica-server/sync";
import {createTrackingHttp} from "./helpers/tracking-http";

const METHODS = ["get", "delete", "head", "post", "patch", "put"] as const;

function fire(http: SyncHttpClient, count: number, method: (typeof METHODS)[number] = "get") {
  return Promise.all(Array.from({length: count}, (_, i) => http[method](`item/${i}`)));
}

describe("limitConcurrency", () => {
  describe("cap", () => {
    it("never runs more requests at once than the limit", async () => {
      const tracking = createTrackingHttp();
      await fire(limitConcurrency(tracking, 3), 30);

      expect(tracking.calls).toHaveLength(30);
      expect(tracking.peak).toBe(3);
    });

    it("serializes requests when the limit is 1", async () => {
      const tracking = createTrackingHttp();
      await fire(limitConcurrency(tracking, 1), 8);

      expect(tracking.peak).toBe(1);
    });

    it("does not delay requests while under the limit", async () => {
      const tracking = createTrackingHttp();
      await fire(limitConcurrency(tracking, 10), 4);

      expect(tracking.peak).toBe(4);
    });

    it("shares one pool across all request methods", async () => {
      const tracking = createTrackingHttp();
      const limited = limitConcurrency(tracking, 2);

      await Promise.all(METHODS.flatMap(method => [limited[method]("a"), limited[method]("b")]));

      expect(tracking.calls).toHaveLength(12);
      expect(tracking.peak).toBe(2);
    });

    it("keeps the cap across successive bursts", async () => {
      const tracking = createTrackingHttp();
      const limited = limitConcurrency(tracking, 2);

      await fire(limited, 5);
      await fire(limited, 5);

      expect(tracking.peak).toBe(2);
      expect(tracking.inFlight).toBe(0);
    });

    it("starts queued requests in the order they were issued", async () => {
      const tracking = createTrackingHttp();
      await fire(limitConcurrency(tracking, 2), 6);

      expect(tracking.calls.map(c => c.url)).toEqual([0, 1, 2, 3, 4, 5].map(i => `item/${i}`));
    });

    it("starts the next queued request as soon as a slot frees up", async () => {
      const release: Array<() => void> = [];
      const started: string[] = [];
      const http = {
        get: (url: string) =>
          new Promise<void>(resolve => {
            started.push(url);
            release.push(resolve);
          })
      } as unknown as SyncHttpClient;
      const limited = limitConcurrency(http, 2);

      const pending = ["a", "b", "c"].map(url => limited.get(url));
      await Promise.resolve();
      expect(started).toEqual(["a", "b"]);

      release[0]();
      await pending[0];
      await Promise.resolve();
      expect(started).toEqual(["a", "b", "c"]);

      release[1]();
      release[2]();
      await Promise.all(pending);
    });
  });

  describe("pass-through", () => {
    it("forwards arguments untouched", async () => {
      const http = {
        post: jest.fn().mockResolvedValue("created"),
        get: jest.fn(),
        put: jest.fn(),
        patch: jest.fn(),
        delete: jest.fn(),
        head: jest.fn()
      };
      const limited = limitConcurrency(http as SyncHttpClient, 2);

      await limited.post("bucket", {title: "x"}, {params: {a: 1}});

      expect(http.post).toHaveBeenCalledWith("bucket", {title: "x"}, {params: {a: 1}});
    });

    it.each(METHODS)("resolves with the response body of %s", async method => {
      const tracking = createTrackingHttp((m, url) => ({m, url}));
      const limited = limitConcurrency(tracking, 2);

      await expect(limited[method]("thing")).resolves.toEqual({m: method, url: "thing"});
    });

    it("answers each queued caller with its own response", async () => {
      const tracking = createTrackingHttp((_, url) => url.toUpperCase());
      const results = await fire(limitConcurrency(tracking, 2), 5);

      expect(results).toEqual(["ITEM/0", "ITEM/1", "ITEM/2", "ITEM/3", "ITEM/4"]);
    });

    it("calls the underlying methods on the original client", async () => {
      const client = {
        base: "https://spica.test",
        get(this: {base: string}, url: string) {
          return Promise.resolve(`${this.base}/${url}`);
        }
      };
      const limited = limitConcurrency(client as unknown as SyncHttpClient, 2);

      await expect(limited.get("fn")).resolves.toBe("https://spica.test/fn");
    });

    it("leaves the original client unchanged", async () => {
      const tracking = createTrackingHttp();
      const originalGet = tracking.get;

      limitConcurrency(tracking, 1);
      await fire(tracking, 5);

      expect(tracking.get).toBe(originalGet);
      expect(tracking.peak).toBe(5);
    });
  });

  describe("failures", () => {
    it("rejects with the original error", async () => {
      const error = Object.assign(new Error("boom"), {status: 429});
      const http = {get: () => Promise.reject(error)} as unknown as SyncHttpClient;

      await expect(limitConcurrency(http, 2).get("x")).rejects.toBe(error);
    });

    it("releases the slot when a request fails", async () => {
      const http = {
        get: jest.fn((url: string) =>
          url === "bad" ? Promise.reject(new Error("bad")) : Promise.resolve("ok")
        )
      } as unknown as SyncHttpClient;
      const limited = limitConcurrency(http, 1);

      const results = await Promise.allSettled([
        limited.get("bad"),
        limited.get("good"),
        limited.get("good")
      ]);

      expect(results.map(r => r.status)).toEqual(["rejected", "fulfilled", "fulfilled"]);
    });

    it("releases the slot when the client throws synchronously", async () => {
      const http = {
        get: jest.fn((url: string) => {
          if (url === "bad") throw new Error("sync boom");
          return Promise.resolve("ok");
        })
      } as unknown as SyncHttpClient;
      const limited = limitConcurrency(http, 1);

      const results = await Promise.allSettled([limited.get("bad"), limited.get("good")]);

      expect(results.map(r => r.status)).toEqual(["rejected", "fulfilled"]);
    });

    it("keeps draining the queue when every other request fails", async () => {
      let calls = 0;
      const http = {
        get: () => (++calls % 2 ? Promise.reject(new Error("odd")) : Promise.resolve("even"))
      } as unknown as SyncHttpClient;
      const limited = limitConcurrency(http, 2);

      const settled = await Promise.allSettled(Array.from({length: 6}, () => limited.get("x")));

      expect(settled.filter(r => r.status === "fulfilled")).toHaveLength(3);
      expect(calls).toBe(6);
    });
  });

  describe("limit normalization", () => {
    it.each([0, -4, 0.4])("treats %p as 1", async limit => {
      const tracking = createTrackingHttp();
      await fire(limitConcurrency(tracking, limit), 6);

      expect(tracking.peak).toBe(1);
    });

    it("rounds fractional limits down", async () => {
      const tracking = createTrackingHttp();
      await fire(limitConcurrency(tracking, 2.9), 10);

      expect(tracking.peak).toBe(2);
    });

    it.each([NaN, Infinity, -Infinity])("falls back to the default for %p", async limit => {
      const tracking = createTrackingHttp();
      await fire(limitConcurrency(tracking, limit), DEFAULT_CONCURRENCY * 3);

      expect(tracking.peak).toBe(DEFAULT_CONCURRENCY);
    });

    it("uses the default limit when none is given", async () => {
      const tracking = createTrackingHttp();
      await fire(limitConcurrency(tracking), DEFAULT_CONCURRENCY * 3);

      expect(tracking.peak).toBe(DEFAULT_CONCURRENCY);
    });
  });

  describe("abort signal", () => {
    function gatedClient() {
      const started: string[] = [];
      const release: Array<() => void> = [];
      const http = {
        get: (url: string) =>
          new Promise<string>(resolve => {
            started.push(url);
            release.push(() => resolve(url));
          })
      } as unknown as SyncHttpClient;
      return {http, started, release};
    }

    it("fails queued requests with the abort reason instead of sending them", async () => {
      const {http, started, release} = gatedClient();
      const controller = new AbortController();
      const limited = limitConcurrency(http, 1, controller.signal);
      const reason = new Error("stop");

      const results = Promise.allSettled(Array.from({length: 4}, (_, i) => limited.get(`i${i}`)));
      await tick();
      controller.abort(reason);
      release[0]();
      const settled = await results;

      expect(started).toEqual(["i0"]);
      expect(settled.map(r => r.status)).toEqual(["fulfilled", "rejected", "rejected", "rejected"]);
      expect((settled[1] as PromiseRejectedResult).reason).toBe(reason);
    });

    it("lets requests that already started finish", async () => {
      const {http, release} = gatedClient();
      const controller = new AbortController();
      const limited = limitConcurrency(http, 2, controller.signal);

      const running = [limited.get("a"), limited.get("b")];
      await tick();
      controller.abort(new Error("stop"));
      release.forEach(r => r());

      await expect(Promise.all(running)).resolves.toEqual(["a", "b"]);
    });

    it("fails new requests once aborted", async () => {
      const controller = new AbortController();
      const limited = limitConcurrency(createTrackingHttp(), 2, controller.signal);
      controller.abort(new Error("stop"));

      await expect(limited.get("late")).rejects.toThrow("stop");
    });

    it("shares the pool of an already limited client", async () => {
      const tracking = createTrackingHttp();
      const base = limitConcurrency(tracking, 2);
      const withSignal = limitConcurrency(base, 10, new AbortController().signal);

      await Promise.all([fire(base, 6), fire(withSignal, 6)]);

      expect(tracking.peak).toBe(2);
    });

    it("returns the same client when there is no signal to add", () => {
      const base = limitConcurrency(createTrackingHttp(), 2);

      expect(limitConcurrency(base, 10)).toBe(base);
    });
  });

  describe("composition", () => {
    it("returns an already limited client unchanged, so the outer limit wins", async () => {
      const tracking = createTrackingHttp();
      const outer = limitConcurrency(tracking, 2);
      const again = limitConcurrency(outer, 10);

      expect(again).toBe(outer);
      await fire(again, 20);
      expect(tracking.peak).toBe(2);
    });

    it("gives each limited client its own pool", async () => {
      const tracking = createTrackingHttp();
      const first = limitConcurrency(tracking, 2);
      const second = limitConcurrency(tracking, 2);

      await Promise.all([fire(first, 6), fire(second, 6)]);

      expect(tracking.peak).toBe(4);
    });

    it("bounds nested fan-out issued from inside a request-making task", async () => {
      const tracking = createTrackingHttp();
      const limited = limitConcurrency(tracking, 3);

      await Promise.all(
        Array.from({length: 5}, async () => {
          await limited.post("parent", {});
          await fire(limited, 4, "put");
        })
      );

      expect(tracking.calls).toHaveLength(25);
      expect(tracking.peak).toBe(3);
    });
  });
});

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {promise, resolve, reject};
}

const tick = () => new Promise(resolve => setTimeout(resolve, 5));

describe("mapWithConcurrency", () => {
  it("never runs more items at once than the limit", async () => {
    let active = 0;
    let peak = 0;

    await mapWithConcurrency(
      Array.from({length: 20}, (_, i) => i),
      4,
      async () => {
        active++;
        peak = Math.max(peak, active);
        await tick();
        active--;
      }
    );

    expect(peak).toBe(4);
  });

  it("returns results in input order regardless of completion order", async () => {
    const delays = [15, 1, 8, 1, 4];

    const results = await mapWithConcurrency(delays, 3, async (delay, index) => {
      await new Promise(resolve => setTimeout(resolve, delay));
      return `item${index}`;
    });

    expect(results).toEqual(["item0", "item1", "item2", "item3", "item4"]);
  });

  it("passes the item and its index", async () => {
    const seen: Array<[string, number]> = [];

    await mapWithConcurrency(["a", "b", "c"], 2, async (item, index) => {
      seen.push([item, index]);
    });

    expect(seen).toEqual([
      ["a", 0],
      ["b", 1],
      ["c", 2]
    ]);
  });

  it("starts the next item as soon as any slot frees, without waiting for the slowest", async () => {
    const gates = [deferred(), deferred(), deferred(), deferred(), deferred()];
    const started: number[] = [];

    const done = mapWithConcurrency(gates, 2, async (gate, index) => {
      started.push(index);
      await gate.promise;
    });

    await tick();
    expect(started).toEqual([0, 1]);

    gates[1].resolve();
    await tick();
    expect(started).toEqual([0, 1, 2]);

    gates[2].resolve();
    await tick();
    expect(started).toEqual([0, 1, 2, 3]);

    gates[3].resolve();
    await tick();
    expect(started).toEqual([0, 1, 2, 3, 4]);

    gates.forEach(gate => gate.resolve());
    await done;
  });

  it("uses fewer workers than the limit when there are fewer items", async () => {
    let peak = 0;
    let active = 0;

    await mapWithConcurrency([1, 2], 10, async () => {
      active++;
      peak = Math.max(peak, active);
      await tick();
      active--;
    });

    expect(peak).toBe(2);
  });

  it("resolves an empty list without calling the function", async () => {
    const fn = jest.fn();

    await expect(mapWithConcurrency([], 3, fn)).resolves.toEqual([]);
    expect(fn).not.toHaveBeenCalled();
  });

  describe("failure", () => {
    it("rejects with the first error", async () => {
      const first = new Error("first");

      await expect(
        mapWithConcurrency([0, 1, 2], 1, async index => {
          throw index === 0 ? first : new Error("later");
        })
      ).rejects.toBe(first);
    });

    it("stops starting new items after a failure", async () => {
      const started: number[] = [];

      await expect(
        mapWithConcurrency([0, 1, 2, 3, 4, 5], 2, async index => {
          started.push(index);
          await tick();
          if (index === 0) throw new Error("boom");
        })
      ).rejects.toThrow("boom");

      expect(started.length).toBeLessThan(6);
      expect(started).not.toContain(5);
    });

    it("waits for items already running before rejecting", async () => {
      const slow = deferred();
      let slowFinished = false;
      let rejectedAt: boolean | undefined;

      const outcome = mapWithConcurrency([0, 1], 2, async index => {
        if (index === 0) throw new Error("boom");
        await slow.promise;
        slowFinished = true;
      }).catch(() => {
        rejectedAt = slowFinished;
      });

      await tick();
      expect(rejectedAt).toBeUndefined();

      slow.resolve();
      await outcome;
      expect(rejectedAt).toBe(true);
    });

    it("keeps the first error when several running items fail", async () => {
      const gates = [deferred(), deferred()];
      const outcome = mapWithConcurrency(gates, 2, gate => gate.promise);

      gates[1].reject(new Error("second to start, first to fail"));
      await tick();
      gates[0].reject(new Error("other"));

      await expect(outcome).rejects.toThrow("second to start, first to fail");
    });
  });

  describe("limit normalization", () => {
    it.each([0, -3, 0.5])("treats %p as 1", async limit => {
      let peak = 0;
      let active = 0;

      await mapWithConcurrency([1, 2, 3, 4], limit, async () => {
        active++;
        peak = Math.max(peak, active);
        await tick();
        active--;
      });

      expect(peak).toBe(1);
    });

    it("falls back to the default for a non-finite limit", async () => {
      let peak = 0;
      let active = 0;

      await mapWithConcurrency(
        Array.from({length: DEFAULT_CONCURRENCY * 3}, (_, i) => i),
        NaN,
        async () => {
          active++;
          peak = Math.max(peak, active);
          await tick();
          active--;
        }
      );

      expect(peak).toBe(DEFAULT_CONCURRENCY);
    });
  });
});
