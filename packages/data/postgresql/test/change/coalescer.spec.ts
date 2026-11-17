import {
  ChangeNotice,
  Coalescer,
  Notification,
  parseNotification
} from "../../src/change/coalescer.js";

let sequence = 0;

const notification = (overrides: Partial<Notification>): Notification => ({
  table: "bucket_a",
  operation: "update",
  key: "1",
  transaction: "100",
  sequence: ++sequence,
  ...overrides
});

describe("parseNotification", () => {
  it("should read the payload the trigger sends", () => {
    const payload = {
      table: "bucket_a",
      operation: "insert",
      key: "1",
      transaction: "7",
      sequence: 3,
      columns: ["title"]
    };
    expect(parseNotification(JSON.stringify(payload))).toEqual(payload);
  });

  it.each([
    undefined,
    "",
    "not json",
    "{}",
    '{"table":"a","operation":"drop","key":"1","transaction":"1","sequence":1}'
  ])("should ignore %p", payload => {
    expect(parseNotification(payload)).toBeUndefined();
  });
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
    coalescer.push(notification({sequence: 1, operation: "insert", key: "a"}));
    expect(emitted).toEqual([]);

    jest.advanceTimersByTime(5);

    expect(emitted).toEqual([{id: "bucket_a:1", table: "bucket_a", operation: "insert", key: "a"}]);
  });

  it("should flush a transaction as soon as the next one starts", () => {
    coalescer.push(notification({transaction: "1", sequence: 10, key: "a"}));
    coalescer.push(notification({transaction: "2", sequence: 11, key: "b"}));

    expect(emitted.map(notice => notice.key)).toEqual(["a"]);
  });

  it("should keep the insert when the same transaction updates the row", () => {
    coalescer.push(notification({sequence: 1, operation: "insert", key: "a"}));
    coalescer.push(notification({sequence: 2, operation: "update", key: "a", fields: ["tags"]}));
    coalescer.flush();

    expect(emitted).toEqual([
      {id: "bucket_a:1", table: "bucket_a", operation: "insert", key: "a", fields: ["tags"]}
    ]);
  });

  it("should merge the changes of repeated updates", () => {
    coalescer.push(notification({sequence: 1, key: "a", columns: ["title"]}));
    coalescer.push(
      notification({sequence: 2, key: "a", columns: ["age", "title"], fields: ["tags"]})
    );
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
    coalescer.push(notification({sequence: 1, operation: "update", key: "a", fields: ["tags"]}));
    coalescer.push(notification({sequence: 2, operation: "delete", key: "a"}));
    coalescer.flush();

    expect(emitted).toMatchObject([{id: "bucket_a:1", operation: "delete", key: "a"}]);
  });

  it("should emit nothing for a row inserted and deleted in one transaction", () => {
    coalescer.push(notification({sequence: 1, operation: "insert", key: "a"}));
    coalescer.push(notification({sequence: 2, operation: "delete", key: "a"}));
    coalescer.flush();

    expect(emitted).toEqual([]);
  });

  it("should report a replaced row as an update", () => {
    coalescer.push(
      notification({sequence: 1, operation: "delete", key: "a", before: {key: "old"}})
    );
    coalescer.push(notification({sequence: 2, operation: "insert", key: "a"}));
    coalescer.flush();

    expect(emitted).toMatchObject([{operation: "update", key: "a", before: {key: "old"}}]);
  });

  it("should keep the earliest before image", () => {
    coalescer.push(
      notification({sequence: 1, operation: "update", key: "a", before: {key: "first"}})
    );
    coalescer.push(
      notification({sequence: 2, operation: "delete", key: "a", before: {key: "second"}})
    );
    coalescer.flush();

    expect(emitted).toMatchObject([{operation: "delete", before: {key: "first"}}]);
  });

  it("should keep rows and tables apart", () => {
    coalescer.push(notification({sequence: 1, key: "a"}));
    coalescer.push(notification({sequence: 2, key: "b"}));
    coalescer.push(notification({sequence: 3, key: "a", table: "bucket_b"}));
    coalescer.flush();

    expect(emitted.map(notice => notice.id)).toEqual(["bucket_a:1", "bucket_a:2", "bucket_b:3"]);
  });

  it("should give every replica the same id", () => {
    const other: ChangeNotice[] = [];
    const second = new Coalescer(notice => other.push(notice), 5);
    const burst = [
      notification({sequence: 20, operation: "insert", key: "a"}),
      notification({sequence: 21, operation: "update", key: "a", fields: ["tags"]})
    ];

    burst.forEach(item => coalescer.push(item));
    burst.forEach(item => second.push(item));
    coalescer.flush();
    second.flush();

    expect(other).toEqual(emitted);
  });

  it("should drop what is pending on close", () => {
    coalescer.push(notification({key: "a"}));
    coalescer.close();
    jest.advanceTimersByTime(50);

    expect(emitted).toEqual([]);
  });
});
