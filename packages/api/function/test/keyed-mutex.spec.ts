import {KeyedMutex} from "@spica-server/function/src/keyed-mutex";

describe("KeyedMutex", () => {
  let mutex: KeyedMutex;

  beforeEach(() => {
    mutex = new KeyedMutex();
  });

  it("should run tasks for the same key one at a time", async () => {
    const order: string[] = [];
    let release: () => void;
    const first = mutex.run("fn", async () => {
      order.push("first:start");
      await new Promise<void>(resolve => (release = resolve));
      order.push("first:end");
    });
    const second = mutex.run("fn", async () => {
      order.push("second");
    });

    await new Promise(resolve => setImmediate(resolve));
    release();
    await Promise.all([first, second]);

    expect(order).toEqual(["first:start", "first:end", "second"]);
  });

  it("should not hold up tasks for other keys", async () => {
    let release: () => void;
    const blocked = mutex.run("a", () => new Promise<void>(resolve => (release = resolve)));

    await expect(mutex.run("b", async () => "done")).resolves.toBe("done");

    release();
    await blocked;
  });

  it("should keep running queued tasks after one fails", async () => {
    const failed = mutex.run("fn", async () => {
      throw new Error("boom");
    });
    const next = mutex.run("fn", async () => "ok");

    await expect(failed).rejects.toThrow("boom");
    await expect(next).resolves.toBe("ok");
  });
});
