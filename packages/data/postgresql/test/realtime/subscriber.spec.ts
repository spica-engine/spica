import {ChunkKind} from "@spica-server/interface-realtime";
import {BatchQueries} from "../../src/realtime/batch.js";
import {Limiter} from "../../src/realtime/limiter.js";
import {RealtimeSubscriber} from "../../src/realtime/subscriber.js";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const batch = (...keys: string[]) => ({
  changes: keys.map(key => ({key, operation: "insert" as const})),
  queries: new BatchQueries()
});

describe("RealtimeSubscriber", () => {
  let emitted: any[][];
  let errors: Error[];
  let window: {initial: jest.Mock; apply: jest.Mock};
  let subscriber: RealtimeSubscriber;

  beforeEach(() => {
    emitted = [];
    errors = [];
    window = {
      initial: jest.fn(async () => [{kind: ChunkKind.EndOfInitial}]),
      apply: jest.fn(async changes =>
        changes.map((change: any) => ({kind: ChunkKind.Insert, document: {id: change.key}}))
      )
    };
    subscriber = new RealtimeSubscriber(
      new Limiter(2),
      chunks => emitted.push(chunks),
      error => errors.push(error)
    );
  });

  it("should send the initial chunks first", async () => {
    await subscriber.start(window as any);

    expect(emitted).toEqual([[{kind: ChunkKind.EndOfInitial}]]);
  });

  it("should apply the batches that arrived while it started, in order", async () => {
    subscriber.deliver(batch("1"));
    subscriber.deliver(batch("2"));
    await subscriber.start(window as any);
    await sleep(20);

    expect(emitted.map(chunks => chunks[0].kind)).toEqual([
      ChunkKind.EndOfInitial,
      ChunkKind.Insert,
      ChunkKind.Insert
    ]);
    expect(window.apply.mock.calls.map(([changes]) => changes[0].key)).toEqual(["1", "2"]);
  });

  it("should apply one batch at a time", async () => {
    let running = 0;
    let most = 0;
    window.apply.mockImplementation(async () => {
      most = Math.max(most, ++running);
      await sleep(15);
      running--;
      return [];
    });
    await subscriber.start(window as any);

    subscriber.deliver(batch("1"));
    subscriber.deliver(batch("2"));
    subscriber.deliver(batch("3"));
    await sleep(100);

    expect(most).toBe(1);
    expect(window.apply).toHaveBeenCalledTimes(3);
  });

  it("should pass the queries of the batch to the window", async () => {
    await subscriber.start(window as any);
    const delivered = batch("1");

    subscriber.deliver(delivered);
    await sleep(20);

    expect(window.apply).toHaveBeenCalledWith(delivered.changes, delivered.queries);
  });

  it("should report a failing batch once and stop", async () => {
    window.apply.mockRejectedValue(new Error("query"));
    await subscriber.start(window as any);

    subscriber.deliver(batch("1"));
    subscriber.deliver(batch("2"));
    await sleep(40);

    expect(errors).toEqual([new Error("query")]);
    expect(emitted).toHaveLength(1);
  });

  it("should report a failure from outside once", () => {
    subscriber.fail(new Error("gap"));
    subscriber.fail(new Error("again"));

    expect(errors).toEqual([new Error("gap")]);
  });

  it("should send nothing after it was closed", async () => {
    await subscriber.start(window as any);
    subscriber.close();

    subscriber.deliver(batch("1"));
    await sleep(20);

    expect(emitted).toHaveLength(1);
    expect(window.apply).not.toHaveBeenCalled();
  });

  it("should send nothing if it was closed while the initial chunks were read", async () => {
    let finish!: (chunks: any[]) => void;
    window.initial.mockReturnValue(new Promise(resolve => (finish = resolve)));

    const started = subscriber.start(window as any);
    subscriber.close();
    finish([{kind: ChunkKind.EndOfInitial}]);
    await started;

    expect(emitted).toEqual([]);
  });
});
