import {Limiter} from "../../src/realtime/limiter.js";

const gate = () => {
  let open!: () => void;
  const opened = new Promise<void>(resolve => (open = resolve));
  return {open, opened};
};

describe("Limiter", () => {
  it("should run at most as many tasks as allowed", async () => {
    const limiter = new Limiter(2);
    const gates = [gate(), gate(), gate(), gate()];
    let running = 0;
    let most = 0;

    const done = gates.map(({opened}) =>
      limiter.run(async () => {
        most = Math.max(most, ++running);
        await opened;
        running--;
      })
    );
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(running).toBe(2);

    gates.forEach(({open}) => open());
    await Promise.all(done);

    expect(most).toBe(2);
  });

  it("should start the waiting tasks in order", async () => {
    const limiter = new Limiter(1);
    const first = gate();
    const started: number[] = [];

    const done = [first.opened, Promise.resolve(), Promise.resolve()].map((work, index) =>
      limiter.run(async () => {
        started.push(index);
        await work;
      })
    );
    first.open();
    await Promise.all(done);

    expect(started).toEqual([0, 1, 2]);
  });

  it("should give the result of the task back", async () => {
    expect(await new Limiter(1).run(async () => 42)).toBe(42);
  });

  it("should free its place when a task fails", async () => {
    const limiter = new Limiter(1);

    await expect(limiter.run(() => Promise.reject(new Error("no")))).rejects.toThrow("no");

    expect(await limiter.run(async () => "next")).toBe("next");
  });
});
