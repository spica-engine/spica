import {idOf} from "@spica-server/data";
import {INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {BucketModule} from "@spica-server/bucket/src";
import {CoreTestingModule, Request, Websocket} from "@spica-server/core-testing";
import {WsAdapter} from "@spica-server/core-websocket";
import {DatabaseTestingModule} from "@spica-server/database-testing";
import {PassportTestingModule} from "@spica-server/passport-testing";
import {PreferenceTestingModule} from "@spica-server/preference-testing";
import {
  CREATED_AT,
  DATE_TIME,
  OBJECT_ID,
  OBJECTID_STRING,
  SchemaModule,
  UPDATED_AT
} from "@spica-server/core-schema";
import {ChunkKind} from "@spica-server/interface-realtime";

jest.setTimeout(60_000);

function url(path: string, query?: {[k: string]: string | number}) {
  const target = new URL(path, "ws://insteadof");
  for (const key in query) {
    target.searchParams.set(key, String(query[key]));
  }
  return `${target.pathname}${target.search}`;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function until(condition: () => boolean) {
  for (let waited = 0; waited < 15_000 && !condition(); waited += 25) {
    await sleep(25);
  }
}

describe("Realtime on PostgreSQL", () => {
  let wsc: Websocket;
  let app: INestApplication;
  let req: Request;
  let bucket: any;
  let opened: {readyState: number; close(): Promise<unknown>}[];

  const insertRow = (document: object) =>
    req.post(`/bucket/${idOf(bucket)}/data`, document).then(response => response.body);

  async function connect(query?: {[k: string]: string | number}) {
    const messages: any[] = [];
    const ws = wsc.get(url(`/bucket/${idOf(bucket)}/data`, query));
    opened.push(ws);
    ws.onmessage = event => messages.push(JSON.parse(event.data as string));
    await ws.connect;
    await until(() =>
      messages.some(message => message.kind == ChunkKind.EndOfInitial || message.kind < 0)
    );
    return messages;
  }

  const kinds = (messages: any[]) => messages.map(message => ChunkKind[message.kind]);

  beforeEach(async () => {
    opened = [];
    const module = await Test.createTestingModule({
      imports: [
        SchemaModule.forRoot({
          formats: [OBJECT_ID, DATE_TIME, OBJECTID_STRING],
          defaults: [CREATED_AT, UPDATED_AT]
        }),
        DatabaseTestingModule.postgres(),
        CoreTestingModule,
        PreferenceTestingModule,
        BucketModule.forRoot({
          history: false,
          hooks: false,
          realtime: true,
          cache: false,
          graphql: false
        }),
        PassportTestingModule.initialize({overriddenStrategyType: "APIKEY"})
      ]
    }).compile();
    module.enableShutdownHooks();
    wsc = module.get(Websocket);
    req = module.get(Request);
    app = module.createNestApplication();
    app.useWebSocketAdapter(new WsAdapter(app));
    await app.listen(wsc.socket);

    const {body} = await req.post("/bucket", {
      title: "Realtime",
      description: "Realtime",
      primary: "id",
      properties: {
        id: {type: "uuid", options: {generated: true}},
        title: {type: "string"}
      }
    });
    bucket = body;
  });

  afterEach(async () => {
    await Promise.all(opened.filter(ws => ws.readyState <= 1).map(ws => ws.close()));
    await app.close();
  });

  it("should do the initial sync", async () => {
    await insertRow({title: "first"});
    await insertRow({title: "second"});

    const messages = await connect();

    expect(kinds(messages)).toEqual(["Initial", "Initial", "EndOfInitial"]);
    expect(
      messages
        .slice(0, 2)
        .map(message => message.document.title)
        .sort()
    ).toEqual(["first", "second"]);
  });

  it("should do the initial sync with an expression filter", async () => {
    await insertRow({title: "first"});
    const second = await insertRow({title: "second"});

    const messages = await connect({filter: `document.title == "second"`});

    expect(messages).toEqual([
      {kind: ChunkKind.Initial, document: second},
      {kind: ChunkKind.EndOfInitial}
    ]);
  });

  it("should do the initial sync with a limit and a skip", async () => {
    await insertRow({title: "first"});
    await insertRow({title: "second"});
    await insertRow({title: "third"});

    const messages = await connect({sort: JSON.stringify({title: 1}), skip: 1, limit: 1});

    expect(messages.map(message => message.document?.title)).toEqual(["second", undefined]);
  });

  it("should send what is inserted after the initial sync", async () => {
    const messages = await connect();

    const inserted = await insertRow({title: "later"});
    await until(() => messages.length > 1);

    expect(messages).toEqual([
      {kind: ChunkKind.EndOfInitial},
      {kind: ChunkKind.Insert, document: inserted}
    ]);
  });

  it("should answer a MongoDB filter with an error", async () => {
    const messages = await connect({filter: JSON.stringify({title: "first"})});

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({kind: ChunkKind.Error});
  });
});
