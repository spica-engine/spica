import {INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {RealtimeModule} from "@spica-server/bucket/realtime";
import {getBucketDataCollection} from "@spica-server/bucket/realtime/src/realtime.gateway";
import {CoreTestingModule, Websocket} from "@spica-server/core/testing";
import {WsAdapter} from "@spica-server/core/websocket";
import {ChunkKind} from "@spica-server/database/realtime";
import {DatabaseService, DatabaseTestingModule} from "@spica-server/database/testing";
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

xdescribe("Realtime", () => {
  let wsc: Websocket;
  let app: INestApplication;
  let db: DatabaseService;
  let rows: object[];

  let id: string;
  let collection: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        DatabaseTestingModule.replicaSet(),
        CoreTestingModule,
        RealtimeModule,
        PassportTestingModule.initialize()
      ]
    }).compile();
    db = module.get(DatabaseService);
    wsc = module.get(Websocket);
    app = module.createNestApplication();
    app.useWebSocketAdapter(new WsAdapter(app));
    await app.listen(wsc.socket);
  });

  afterAll(() => app.close());

  beforeEach(async () => {
    id = "test";
    collection = getBucketDataCollection(id);
    rows = await db
      .collection(collection)
      .insertMany([
        {
          title: "first row",
          description: "first rows description"
        },
        {
          title: "second row",
          description: "second rows description"
        }
      ])
      .then(r => r.ops.map(({_id, ...rest}) => ({_id: _id.toString(), ...rest})));
  });

  afterEach(async () => {
    await db.collection(collection).drop();
  });

  it("should do the initial sync", async () => {
    const ws = wsc.get("/bucket/test/data");
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
    const ws = wsc.get(url("/bucket/test/data", {filter: {title: "second row"}}));
    const message = jasmine.createSpy();
    ws.onmessage = e => message(JSON.parse(e.data as string));
    await ws.connect;
    await ws.close();
    expect(message.calls.allArgs().map(c => c[0])).toEqual([
      {kind: ChunkKind.Initial, document: rows[1]},
      {kind: ChunkKind.EndOfInitial}
    ]);
  });

  it("should do the initial sync with limit", async () => {
    const ws = wsc.get(url("/bucket/test/data", {limit: 1}));
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
    const ws = wsc.get(url("/bucket/test/data", {skip: 1}));
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
      .collection(collection)
      .insertMany([
        {
          title: "third row",
          description: "third rows description"
        },
        {
          title: "fourth row",
          description: "fourth rows description"
        }
      ])
      .then(r => r.ops.map(({_id, ...rest}) => ({_id: _id.toString(), ...rest})));
    const ws = wsc.get(url("/bucket/test/data", {skip: 1, limit: 2}));
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
    const ws = wsc.get(url("/bucket/test/data", {sort: {_id: -1}}));
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
});
