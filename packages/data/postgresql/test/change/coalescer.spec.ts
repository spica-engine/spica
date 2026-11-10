import {
  ChangeNotice,
  Coalescer,
  Notification,
  parseNotification
} from "../../src/change/coalescer.js";

let sequence = 0;

const notification = (overrides: Partial<Notification>): Notification => ({
  t: "bucket_a",
  op: "update",
  k: "1",
  x: "100",
  s: ++sequence,
  ...overrides
});

describe("parseNotification", () => {
  it("should read the payload the trigger sends", () => {
    const payload = {t: "bucket_a", op: "insert", k: "1", x: "7", s: 3, c: ["title"]};
    expect(parseNotification(JSON.stringify(payload))).toEqual(payload);
  });

  it.each([undefined, "", "not json", "{}", '{"t":"a","op":"drop","k":"1","x":"1","s":1}'])(
    "should ignore %p",
    payload => {
      expect(parseNotification(payload)).toBeUndefined();
    }
  );
});

describe("Coalescer", () => {
  let emitted: ChangeNotice[];
  let coalescer: Coalescer;

  beforeEach(() => {
    jest.useFakeTimers();
    emitted = [];
    coalescer = new Coalescer(notice => emitted.push(notice), 5);
  });

  afterEach(() => {
    coalescer.close();
    jest.useRealTimers();
  });

  it("should emit a lone notification after the delay", () => {
    coalescer.push(notification({s: 1, op: "insert", k: "a"}));
    expect(emitted).toEqual([]);

    jest.advanceTimersByTime(5);

    expect(emitted).toEqual([{id: "bucket_a:1", table: "bucket_a", operation: "insert", key: "a"}]);
  });

  it("should flush a transaction as soon as the next one starts", () => {
    coalescer.push(notification({x: "1", s: 10, k: "a"}));
    coalescer.push(notification({x: "2", s: 11, k: "b"}));

    expect(emitted.map(notice => notice.key)).toEqual(["a"]);
  });

  it("should keep the insert when the same transaction updates the row", () => {
    coalescer.push(notification({s: 1, op: "insert", k: "a"}));
    coalescer.push(notification({s: 2, op: "update", k: "a", f: ["tags"]}));
    coalescer.flush();

    expect(emitted).toEqual([
      {id: "bucket_a:1", table: "bucket_a", operation: "insert", key: "a", fields: ["tags"]}
    ]);
  });

  it("should merge the changes of repeated updates", () => {
    coalescer.push(notification({s: 1, k: "a", c: ["title"]}));
    coalescer.push(notification({s: 2, k: "a", c: ["age", "title"], f: ["tags"]}));
    coalescer.flush();

    expect(emitted).toEqual([
      {
        id: "bucket_a:1",
        table: "bucket_a",
        operation: "update",
        key: "a",
        columns: ["title", "age"],
        fields: ["tags"]
      }
    ]);
  });

  it("should report a delete after cascaded updates as one delete", () => {
    coalescer.push(notification({s: 1, op: "update", k: "a", f: ["tags"]}));
    coalescer.push(notification({s: 2, op: "delete", k: "a"}));
    coalescer.flush();

    expect(emitted).toMatchObject([{id: "bucket_a:1", operation: "delete", key: "a"}]);
  });

  it("should emit nothing for a row inserted and deleted in one transaction", () => {
    coalescer.push(notification({s: 1, op: "insert", k: "a"}));
    coalescer.push(notification({s: 2, op: "delete", k: "a"}));
    coalescer.flush();

    expect(emitted).toEqual([]);
  });

  it("should report a replaced row as an update", () => {
    coalescer.push(notification({s: 1, op: "delete", k: "a", b: {key: "old"}}));
    coalescer.push(notification({s: 2, op: "insert", k: "a"}));
    coalescer.flush();

    expect(emitted).toMatchObject([{operation: "update", key: "a", before: {key: "old"}}]);
  });

  it("should keep the earliest before image", () => {
    coalescer.push(notification({s: 1, op: "update", k: "a", b: {key: "first"}}));
    coalescer.push(notification({s: 2, op: "delete", k: "a", b: {key: "second"}}));
    coalescer.flush();

    expect(emitted).toMatchObject([{operation: "delete", before: {key: "first"}}]);
  });

  it("should keep rows and tables apart", () => {
    coalescer.push(notification({s: 1, k: "a"}));
    coalescer.push(notification({s: 2, k: "b"}));
    coalescer.push(notification({s: 3, k: "a", t: "bucket_b"}));
    coalescer.flush();

    expect(emitted.map(notice => notice.id)).toEqual(["bucket_a:1", "bucket_a:2", "bucket_b:3"]);
  });

  it("should give every replica the same id", () => {
    const other: ChangeNotice[] = [];
    const second = new Coalescer(notice => other.push(notice), 5);
    const burst = [
      notification({s: 20, op: "insert", k: "a"}),
      notification({s: 21, op: "update", k: "a", f: ["tags"]})
    ];

    burst.forEach(item => coalescer.push(item));
    burst.forEach(item => second.push(item));
    coalescer.flush();
    second.flush();

    expect(other).toEqual(emitted);
  });

  it("should drop what is pending on close", () => {
    coalescer.push(notification({k: "a"}));
    coalescer.close();
    jest.advanceTimersByTime(50);

    expect(emitted).toEqual([]);
  });
});
