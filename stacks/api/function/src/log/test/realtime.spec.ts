import {INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {LogModule} from "@spica-server/function/src/log";
import {CoreTestingModule, Websocket} from "@spica-server/core/testing";
import {WsAdapter} from "@spica-server/core/websocket";
import {ChunkKind} from "@spica-server/database/realtime";
import {DatabaseService, DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {PassportTestingModule} from "@spica-server/passport/testing";

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

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        DatabaseTestingModule.replicaSet(),
        CoreTestingModule,
        LogModule.forRoot({expireAfterSeconds: 60}),
        PassportTestingModule.initialize()
      ]
    }).compile();
    db = module.get(DatabaseService);
    wsc = module.get(Websocket);
    app = module.createNestApplication();
    app.useWebSocketAdapter(new WsAdapter(app));
    await app.listen(wsc.socket);

    await new Promise(resolve => setTimeout(() => resolve(), 2000));
  });

  afterAll(() => app.close());

  beforeEach(async () => {
    rows = await db
      .collection("function_logs")
      .insertMany([
        {
          function: fn1.toHexString(),
          event_id: "event_id",
          content: "content"
        },
        {
          function: fn2.toHexString(),
          event_id: "event_id2",
          content: "Function (default) did not finish within 84 seconds. Aborting."
        }
      ])
      .then(r => r.ops.map(({_id, ...rest}) => ({_id: _id.toString(), ...rest})));
  });

  afterEach(async () => {
    await db.collection("function_logs").drop();
  });

  it("should do the initial sync", async () => {
    const ws = wsc.get("/function-logs");
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
    const ws = wsc.get(url(`/function-logs?functions=${fn1}`));
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
    const ws = wsc.get(url(`/function-logs?functions=${fn1}&functions=${fn2}`));
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
    const ws = wsc.get(url(`/function-logs`, {limit: 1}));
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
    const ws = wsc.get(url("/function-logs", {skip: 1}));
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
      .insert({
        function: new ObjectId().toHexString(),
        event_id: "event_id",
        content: "content"
      })
      .then(r => r.ops.map(({_id, ...rest}) => ({_id: _id.toString(), ...rest})));
    const ws = wsc.get(url("/function-logs", {skip: 1, limit: 2}));
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
    const ws = wsc.get(url("/function-logs", {sort: {_id: -1}}));
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

  it("should do the initial sync with date filter", async () => {
    let tomorrow = new Date(new Date().getTime() - 86400000);
    const newRows = await db
      .collection("function_logs")
      .insert({
        _id: ObjectId.createFromTime(tomorrow.getTime() / 1000),
        function: new ObjectId().toHexString(),
        event_id: "event_id",
        content: "content"
      })
      .then(r => r.ops.map(({_id, ...rest}) => ({_id: _id.toString(), ...rest})));
    const ws = wsc.get(
      url("/function-logs", {
        begin: new Date(tomorrow.setUTCHours(0, 0, 0, 0)).toISOString(),
        end: new Date(tomorrow.setUTCHours(23, 59, 59, 999)).toISOString()
      })
    );
    const message = jasmine.createSpy();
    ws.onmessage = e => message(JSON.parse(e.data as string));
    await ws.connect;
    await ws.close();
    expect(message.calls.allArgs().map(c => c[0])).toEqual([
      {kind: ChunkKind.Initial, document: newRows[0]},
      {kind: ChunkKind.EndOfInitial}
    ]);
  });
});
