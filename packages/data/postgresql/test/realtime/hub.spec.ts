import {ChangeEvent} from "@spica-server/interface-data";
import {Observable, Subject} from "rxjs";
import {HubBatch, HubFeed, HubMember, RealtimeHub} from "../../src/realtime/hub.js";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class FakeFeed implements HubFeed {
  readonly events = new Subject<ChangeEvent>();
  readonly gapped = new Subject<void>();
  watching = 0;
  watched: string[] = [];
  options: unknown[] = [];

  get gaps() {
    return this.gapped.asObservable();
  }

  watch(collection: string, options?: unknown) {
    this.watched.push(collection);
    this.options.push(options);
    return new Observable<ChangeEvent>(observer => {
      this.watching++;
      const subscription = this.events.subscribe(observer);
      return () => {
        this.watching--;
        subscription.unsubscribe();
      };
    });
  }
}

const member = () => {
  const batches: HubBatch[] = [];
  const failures: Error[] = [];
  const instance: HubMember = {
    deliver: batch => batches.push(batch),
    fail: error => failures.push(error)
  };
  return {instance, batches, failures};
};

const event = (overrides: Partial<ChangeEvent>): ChangeEvent => ({
  id: "x",
  operation: "insert",
  collection: "bucket_a",
  key: "1",
  ...overrides
});

describe("RealtimeHub", () => {
  let feed: FakeFeed;
  let empty: jest.Mock;
  let hub: RealtimeHub;
  const interrupted = new Error("interrupted");

  beforeEach(() => {
    feed = new FakeFeed();
    empty = jest.fn();
    hub = new RealtimeHub(feed, "bucket_a", empty, () => interrupted);
  });

  it("should watch the collection once for every member", () => {
    hub.join(member().instance);
    hub.join(member().instance);

    expect(feed.watched).toEqual(["bucket_a"]);
    expect(feed.watching).toBe(1);
  });

  it("should ask the feed for the current document of every update", () => {
    hub.join(member().instance);

    expect(feed.options).toEqual([{document: "current"}]);
  });

  it("should hand every member the same batch of what changed within a moment", async () => {
    const first = member();
    const second = member();
    hub.join(first.instance);
    hub.join(second.instance);

    feed.events.next(event({key: "1"}));
    feed.events.next(event({key: "2", operation: "delete"}));
    await sleep(40);

    expect(first.batches).toHaveLength(1);
    expect(first.batches[0].changes.map(change => [change.key, change.operation])).toEqual([
      ["1", "insert"],
      ["2", "delete"]
    ]);
    expect(second.batches[0]).toBe(first.batches[0]);
  });

  it("should send a new batch with its own queries for the next moment", async () => {
    const one = member();
    hub.join(one.instance);

    feed.events.next(event({key: "1"}));
    await sleep(40);
    feed.events.next(event({key: "2"}));
    await sleep(40);

    expect(one.batches).toHaveLength(2);
    expect(one.batches[1].queries).not.toBe(one.batches[0].queries);
  });

  it("should read a replacement as an update and pass what changed along", async () => {
    const one = member();
    hub.join(one.instance);

    feed.events.next(event({key: "1", operation: "replace", document: {id: "1"}}));
    feed.events.next(
      event({
        key: "2",
        operation: "update",
        changes: {updated: {title: "a"}, removed: ["old"]},
        document: {id: "2"}
      })
    );
    await sleep(40);

    expect(one.batches[0].changes).toEqual([
      {key: "1", operation: "update", document: {id: "1"}},
      {key: "2", operation: "update", fields: ["title", "old"], document: {id: "2"}}
    ]);
  });

  it("should ignore events that name no row", async () => {
    const one = member();
    hub.join(one.instance);

    feed.events.next(event({key: undefined}));
    feed.events.next(event({operation: "drop"}));
    await sleep(40);

    expect(one.batches).toEqual([]);
  });

  it("should stop sending to a member that left and stop watching with the last one", async () => {
    const stays = member();
    const leaves = member();
    const leaveStaying = hub.join(stays.instance);
    const leaveOther = hub.join(leaves.instance);

    leaveOther();
    feed.events.next(event({key: "1"}));
    await sleep(40);

    expect(leaves.batches).toEqual([]);
    expect(stays.batches).toHaveLength(1);
    expect(empty).not.toHaveBeenCalled();

    leaveStaying();

    expect(feed.watching).toBe(0);
    expect(empty).toHaveBeenCalledTimes(1);
  });

  it("should fail every member and let go when the connection was interrupted", () => {
    const first = member();
    const second = member();
    hub.join(first.instance);
    hub.join(second.instance);

    feed.gapped.next();

    expect(first.failures).toEqual([interrupted]);
    expect(second.failures).toEqual([interrupted]);
    expect(feed.watching).toBe(0);
    expect(empty).toHaveBeenCalledTimes(1);
  });

  it("should fail every member when the feed fails", () => {
    const one = member();
    hub.join(one.instance);

    feed.events.error(new Error("feed"));

    expect(one.failures).toEqual([new Error("feed")]);
    expect(empty).toHaveBeenCalledTimes(1);
  });

  it("should watch again for a member that joins after everyone left", () => {
    const leave = hub.join(member().instance);
    leave();

    hub.join(member().instance);

    expect(feed.watched).toEqual(["bucket_a", "bucket_a"]);
    expect(feed.watching).toBe(1);
  });

  it("should not count a member twice when it leaves after the connection was interrupted", () => {
    const leave = hub.join(member().instance);

    feed.gapped.next();
    leave();

    expect(empty).toHaveBeenCalledTimes(1);
  });

  it("should watch again for a member that joins after the connection was interrupted", () => {
    hub.join(member().instance);
    feed.gapped.next();

    hub.join(member().instance);

    expect(feed.watched).toEqual(["bucket_a", "bucket_a"]);
    expect(feed.watching).toBe(1);
  });
});
