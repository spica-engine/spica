import {INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {LogModule} from "@spica-server/function/src/log";
import {CoreTestingModule, Websocket} from "@spica-server/core/testing";
import {WsAdapter} from "@spica-server/core/websocket";
import {DatabaseService, DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {ChunkKind} from "@spica-server/interface/realtime";

function url(path: string, query?: {[k: string]: string | number | boolean | object}) {
  const url = new URL(path, "ws://insteadof");
  for (const key in query) {
    url.searchParams.set(key, (typeof query[key] == "string"
      ? String(query[key])
      : JSON.stringify(query[key])) as string);
  }
  return `${url.pathname}${url.search}`;
}

describe("Realtime", () => {
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
    db = module.get(DatabaseService);
    wsc = module.get(Websocket);
    app = module.createNestApplication();
    app.useWebSocketAdapter(new WsAdapter(app));
    await app.listen(wsc.socket);

    await new Promise(resolve => setTimeout(() => resolve(""), 2000));
  });

  afterAll(() => app.close());

  beforeEach(async () => {
    created_at = new Date();
    rows = await db
      .collection("function_logs")
      .insertMany([
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
      ])
      .then(r =>
        r.ops.map(({_id, created_at, ...rest}) => ({
          _id: _id.toString(),
          created_at: (created_at as Date).toISOString(),
          ...rest
        }))
      );
  });

  afterEach(async () => {
    await db.collection("function_logs").drop();
  });

  it("should do the initial sync", async () => {
    const ws = wsc.get(url(`/function-logs?begin=${created_at.toString()}`));
    const message = jasmine.createSpy();
    ws.onmessage = e => message(JSON.parse(e.data as string));
    await ws.connect;
    await ws.close();
    expect(message.calls.allArgs().map(c => c[0])).toEqual([
      {kind: ChunkKind.Initial, document: rows[0]},
      {kind: ChunkKind.Initial, document: rows[1]},
      {kind: ChunkKind.EndOfInitial}
    ]);
  });

  it("should do the initial sync with filter", async () => {
    const ws = wsc.get(url(`/function-logs?functions=${fn1}&begin=${created_at.toString()}`));
    const message = jasmine.createSpy();
    ws.onmessage = e => message(JSON.parse(e.data as string));
    await ws.connect;
    await ws.close();
    expect(message.calls.allArgs().map(c => c[0])).toEqual([
      {kind: ChunkKind.Initial, document: rows[0]},
      {kind: ChunkKind.EndOfInitial}
    ]);
  });

  it("should do the initial sync with filter array", async () => {
    const ws = wsc.get(
      url(`/function-logs?functions=${fn1}&functions=${fn2}&begin=${created_at.toString()}`)
    );
    const message = jasmine.createSpy();
    ws.onmessage = e => message(JSON.parse(e.data as string));
    await ws.connect;
    await ws.close();
    expect(message.calls.allArgs().map(c => c[0])).toEqual([
      {kind: ChunkKind.Initial, document: rows[0]},
      {kind: ChunkKind.Initial, document: rows[1]},
      {kind: ChunkKind.EndOfInitial}
    ]);
  });

  it("should do the initial sync with limit", async () => {
    const ws = wsc.get(url(`/function-logs?begin=${created_at.toString()}`, {limit: 1}));
    const message = jasmine.createSpy();
    ws.onmessage = e => message(JSON.parse(e.data as string));
    await ws.connect;
    await ws.close();
    expect(message.calls.allArgs().map(c => c[0])).toEqual([
      {kind: ChunkKind.Initial, document: rows[0]},
      {kind: ChunkKind.EndOfInitial}
    ]);
  });

  it("should do the initial sync with skip", async () => {
    const ws = wsc.get(url(`/function-logs?begin=${created_at.toString()}`, {skip: 1}));
    const message = jasmine.createSpy();
    ws.onmessage = e => message(JSON.parse(e.data as string));
    await ws.connect;
    await ws.close();
    expect(message.calls.allArgs().map(c => c[0])).toEqual([
      {kind: ChunkKind.Initial, document: rows[1]},
      {kind: ChunkKind.EndOfInitial}
    ]);
  });

  it("should do the initial sync with skip and limit", async () => {
    const newRows = await db
      .collection("function_logs")
      .insertOne({
        function: new ObjectId().toHexString(),
        event_id: "event_id",
        content: "content",
        created_at: created_at
      })
      .then(r =>
        r.ops.map(({_id, created_at, ...rest}) => ({
          _id: _id.toString(),
          created_at: created_at.toISOString(),
          ...rest
        }))
      );
    const ws = wsc.get(url(`/function-logs?begin=${created_at.toString()}`, {skip: 1, limit: 2}));
    const message = jasmine.createSpy();
    ws.onmessage = e => message(JSON.parse(e.data as string));
    await ws.connect;
    await ws.close();
    expect(message.calls.allArgs().map(c => c[0])).toEqual([
      {kind: ChunkKind.Initial, document: rows[1]},
      {kind: ChunkKind.Initial, document: newRows[0]},
      {kind: ChunkKind.EndOfInitial}
    ]);
  });

  it("should do the initial sync with sort", async () => {
    const ws = wsc.get(url(`/function-logs?begin=${created_at.toString()}`, {sort: {_id: -1}}));
    const message = jasmine.createSpy();
    ws.onmessage = e => message(JSON.parse(e.data as string));
    await ws.connect;
    await ws.close();
    expect(message.calls.allArgs().map(c => c[0])).toEqual([
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
    const ws = wsc.get(url(`/function-logs?begin=${created_at.toString()}`));
    const message = jasmine.createSpy();
    ws.onmessage = e => message(JSON.parse(e.data as string));
    await ws.connect;
    await ws.close();
    expect(message.calls.allArgs().map(c => c[0])).toEqual([
      {kind: ChunkKind.Initial, document: rows[0]},
      {kind: ChunkKind.Initial, document: rows[1]},
      {kind: ChunkKind.EndOfInitial}
    ]);
  });
});
