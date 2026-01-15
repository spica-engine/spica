import {INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {LogModule} from "@spica-server/function/log";
import {CoreTestingModule, Websocket} from "@spica-server/core/testing";
import {WsAdapter} from "@spica-server/core/websocket";
import {DatabaseService, DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {ChunkKind} from "@spica-server/interface/realtime";

function url(path: string, query?: {[k: string]: string | string[]}) {
  const url = new URL(path, "ws://insteadof");
  for (const key in query) {
    const value = query[key];
    if (Array.isArray(value)) {
      value.forEach(v => url.searchParams.append(key, v));
    } else {
      url.searchParams.set(key, value);
    }
  }
  return `${url.pathname}${url.search}`;
}

xdescribe("Realtime", () => {
  let wsc: Websocket;
  let app: INestApplication;
  let db: DatabaseService;
  let rows: object[];

  let fn1 = new ObjectId();
  let fn2 = new ObjectId();

  let created_at: Date;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        DatabaseTestingModule.replicaSet(),
        CoreTestingModule,
        LogModule.forRoot({expireAfterSeconds: 60, realtime: true}),
        PassportTestingModule.initialize()
      ]
    }).compile();
    module.enableShutdownHooks();
    db = module.get(DatabaseService);
    wsc = module.get(Websocket);
    app = module.createNestApplication();
    app.useWebSocketAdapter(new WsAdapter(app));
    await app.listen(wsc.socket);

    await new Promise<void>(resolve => setTimeout(() => resolve(), 2000));
  });

  afterAll(() => app.close());

  beforeEach(async () => {
    created_at = new Date();
    const insertData = [
      {
        function: fn1.toHexString(),
        event_id: "event_id",
        content: "content",
        created_at: created_at
      },
      {
        function: fn2.toHexString(),
        event_id: "event_id2",
        content: "Function (default) did not finish within 84 seconds. Aborting.",
        created_at: created_at
      }
    ];
    rows = await db
      .collection("function_logs")
      .insertMany(insertData)
      .then(r =>
        insertData.map(({created_at, ...rest}, index) => ({
          ...rest,
          _id: r.insertedIds[index].toString(),
          created_at: (created_at as Date).toISOString()
        }))
      );
  });

  afterEach(async () => {
    await db.collection("function_logs").drop();
  });

  it("should do the initial sync", async () => {
    const ws = wsc.get(url("/function-logs", {begin: created_at.toString()}));
    const message = jest.fn();
    ws.onmessage = e => message(JSON.parse(e.data as string));
    await ws.connect;
    await ws.close();
    expect(message.mock.calls.map(c => c[0])).toEqual([
      {kind: ChunkKind.Initial, document: rows[0]},
      {kind: ChunkKind.Initial, document: rows[1]},
      {kind: ChunkKind.EndOfInitial}
    ]);
  });

  it("should do the initial sync with filter", async () => {
    const ws = wsc.get(
      url("/function-logs", {
        functions: fn1.toString(),
        begin: created_at.toString()
      })
    );
    const message = jest.fn();
    ws.onmessage = e => message(JSON.parse(e.data as string));
    await ws.connect;
    await ws.close();
    expect(message.mock.calls.map(c => c[0])).toEqual([
      {kind: ChunkKind.Initial, document: rows[0]},
      {kind: ChunkKind.EndOfInitial}
    ]);
  });

  it("should do the initial sync with filter array", async () => {
    const ws = wsc.get(
      url("/function-logs", {
        functions: [fn1.toString(), fn2.toString()],
        begin: created_at.toString()
      })
    );
    const message = jest.fn();
    ws.onmessage = e => message(JSON.parse(e.data as string));
    await ws.connect;
    await ws.close();
    expect(message.mock.calls.map(c => c[0])).toEqual([
      {kind: ChunkKind.Initial, document: rows[0]},
      {kind: ChunkKind.Initial, document: rows[1]},
      {kind: ChunkKind.EndOfInitial}
    ]);
  });

  it("should do the initial sync with limit", async () => {
    const ws = wsc.get(
      url("/function-logs", {
        begin: created_at.toString(),
        limit: String(1)
      })
    );
    const message = jest.fn();
    ws.onmessage = e => message(JSON.parse(e.data as string));
    await ws.connect;
    await ws.close();
    expect(message.mock.calls.map(c => c[0])).toEqual([
      {kind: ChunkKind.Initial, document: rows[0]},
      {kind: ChunkKind.EndOfInitial}
    ]);
  });

  it("should do the initial sync with skip", async () => {
    const ws = wsc.get(
      url("/function-logs", {
        begin: created_at.toString(),
        skip: String(1)
      })
    );
    const message = jest.fn();
    ws.onmessage = e => message(JSON.parse(e.data as string));
    await ws.connect;
    await ws.close();
    expect(message.mock.calls.map(c => c[0])).toEqual([
      {kind: ChunkKind.Initial, document: rows[1]},
      {kind: ChunkKind.EndOfInitial}
    ]);
  });

  it("should do the initial sync with skip and limit", async () => {
    const insertData = {
      function: new ObjectId().toHexString(),
      event_id: "event_id",
      content: "content",
      created_at: created_at
    };
    const newRows = await db
      .collection("function_logs")
      .insertOne(insertData)
      .then(r =>
        [insertData].map(({created_at, ...rest}) => ({
          ...rest,
          _id: r.insertedId.toString(),
          created_at: created_at.toISOString()
        }))
      );
    const ws = wsc.get(
      url("/function-logs", {
        begin: created_at.toString(),
        skip: String(1),
        limit: String(2)
      })
    );
    const message = jest.fn();
    ws.onmessage = e => message(JSON.parse(e.data as string));
    await ws.connect;
    await ws.close();
    expect(message.mock.calls.map(c => c[0])).toEqual([
      {kind: ChunkKind.Initial, document: rows[1]},
      {kind: ChunkKind.Initial, document: newRows[0]},
      {kind: ChunkKind.EndOfInitial}
    ]);
  });

  it("should do the initial sync with sort", async () => {
    const ws = wsc.get(
      url("/function-logs", {
        begin: created_at.toString(),
        sort: JSON.stringify({
          _id: -1
        })
      })
    );
    const message = jest.fn();
    ws.onmessage = e => message(JSON.parse(e.data as string));
    await ws.connect;
    await ws.close();
    expect(message.mock.calls.map(c => c[0])).toEqual([
      {kind: ChunkKind.Initial, document: rows[1]},
      {kind: ChunkKind.Initial, document: rows[0]},
      {kind: ChunkKind.EndOfInitial}
    ]);
  });

  it("should not include logs which were created yesterday", async () => {
    await db.collection("function_logs").insertOne({
      function: new ObjectId().toHexString(),
      event_id: "event_id",
      content: "content",
      created_at: new Date(new Date().getTime() - 1000 * 60 * 60 * 24)
    });
    const ws = wsc.get(
      url("/function-logs", {
        begin: created_at.toString()
      })
    );
    const message = jest.fn();
    ws.onmessage = e => message(JSON.parse(e.data as string));
    await ws.connect;
    await ws.close();
    expect(message.mock.calls.map(c => c[0])).toEqual([
      {kind: ChunkKind.Initial, document: rows[0]},
      {kind: ChunkKind.Initial, document: rows[1]},
      {kind: ChunkKind.EndOfInitial}
    ]);
  });

  it("should do the initial sync with content", async () => {
    const ws = wsc.get(
      url("/function-logs", {
        begin: created_at.toString(),
        content: "finish"
      })
    );

    const message = jest.fn();
    ws.onmessage = e => message(JSON.parse(e.data as string));

    await ws.connect;
    await ws.close();

    expect(message.mock.calls.map(c => c[0])).toEqual([
      {kind: ChunkKind.Initial, document: rows[1]},
      {kind: ChunkKind.EndOfInitial}
    ]);
  });
});
