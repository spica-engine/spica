import {EventEmitter} from "events";
import type pg from "pg";
import {ChangeNotice} from "../../src/change/coalescer.js";
import {ChangeListener} from "../../src/change/listener.js";

class FakeClient extends EventEmitter {
  queries: string[] = [];
  ended = false;

  constructor(private readonly connectError?: Error) {
    super();
  }

  async connect() {
    if (this.connectError) {
      throw this.connectError;
    }
  }

  async query(text: string) {
    this.queries.push(text);
  }

  async end() {
    this.ended = true;
  }

  announce(payload: object) {
    this.emit("notification", {channel: "spica_change", payload: JSON.stringify(payload)});
  }
}

const insert = (key: string, sequence: number) => ({
  table: "bucket_a",
  operation: "insert",
  key,
  transaction: String(sequence),
  sequence
});

const eventually = async (condition: () => boolean) => {
  for (let waited = 0; waited < 5000 && !condition(); waited += 10) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }
};

describe("ChangeListener", () => {
  let clients: FakeClient[];
  let listener: ChangeListener;
  let notices: ChangeNotice[];
  let gaps: jest.Mock;

  const build = (...plan: (Error | undefined)[]) => {
    let created = 0;
    listener = new ChangeListener("postgres://test", () => {
      const client = new FakeClient(plan[created++]);
      clients.push(client);
      return client as unknown as pg.Client;
    });
    listener.notices.subscribe(notice => notices.push(notice));
    listener.gaps.subscribe(gaps);
  };

  beforeEach(() => {
    clients = [];
    notices = [];
    gaps = jest.fn();
  });

  afterEach(() => listener.stop());

  it("should listen on the change channel", async () => {
    build();

    await listener.start();

    expect(clients).toHaveLength(1);
    expect(clients[0].queries).toEqual(["LISTEN spica_change"]);
  });

  it("should connect once however often it is started", async () => {
    build();

    await Promise.all([listener.start(), listener.start()]);

    expect(clients).toHaveLength(1);
  });

  it("should publish what the server announces", async () => {
    build();
    await listener.start();

    clients[0].announce(insert("1", 1));
    await eventually(() => notices.length == 1);

    expect(notices).toEqual([{id: "bucket_a:1", table: "bucket_a", operation: "insert", key: "1"}]);
  });

  it("should ignore what is not a change", async () => {
    build();
    await listener.start();

    clients[0].emit("notification", {channel: "spica_change", payload: "garbage"});
    clients[0].emit("notification", {channel: "spica_change"});
    clients[0].announce(insert("1", 1));
    await eventually(() => notices.length == 1);

    expect(notices.map(notice => notice.key)).toEqual(["1"]);
  });

  it("should listen again and report a gap when the connection ends", async () => {
    build();
    await listener.start();

    clients[0].emit("end");
    await eventually(() => gaps.mock.calls.length == 1);

    expect(clients).toHaveLength(2);
    expect(clients[1].queries).toEqual(["LISTEN spica_change"]);
    clients[1].announce(insert("2", 2));
    await eventually(() => notices.length == 1);
    expect(notices.map(notice => notice.key)).toEqual(["2"]);
  });

  it("should treat a connection error like the end of the connection", async () => {
    build();
    await listener.start();

    clients[0].emit("error", new Error("terminating connection"));
    clients[0].emit("end");
    await eventually(() => gaps.mock.calls.length == 1);

    expect(clients).toHaveLength(2);
    expect(gaps).toHaveBeenCalledTimes(1);
  });

  it("should keep what was announced before the connection ended", async () => {
    build();
    await listener.start();

    clients[0].announce(insert("1", 1));
    clients[0].emit("end");
    await eventually(() => notices.length == 1);

    expect(notices.map(notice => notice.key)).toEqual(["1"]);
  });

  it("should retry until the server accepts the connection, without reporting a gap", async () => {
    build(new Error("refused"), new Error("refused"));

    await listener.start();

    expect(clients).toHaveLength(3);
    expect(clients.slice(0, 2).every(client => client.ended)).toBe(true);
    expect(gaps).not.toHaveBeenCalled();
  });

  it("should stop listening and not reconnect after stop", async () => {
    build();
    await listener.start();

    await listener.stop();
    clients[0].emit("end");
    await new Promise(resolve => setTimeout(resolve, 200));

    expect(clients[0].ended).toBe(true);
    expect(clients).toHaveLength(1);
  });
});
