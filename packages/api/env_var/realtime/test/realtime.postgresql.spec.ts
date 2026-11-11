import {INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {
  CREATED_AT,
  DATE_TIME,
  OBJECT_ID,
  OBJECTID_STRING,
  SchemaModule,
  UPDATED_AT
} from "@spica-server/core-schema";
import {CoreTestingModule, Request, Websocket} from "@spica-server/core-testing";
import {WsAdapter} from "@spica-server/core-websocket";
import {DatabaseTestingModule} from "@spica-server/database-testing";
import {EnvVarModule} from "@spica-server/env_var";
import {ChunkKind} from "@spica-server/interface-realtime";
import {GuardService} from "@spica-server/passport-guard-services";
import {PassportTestingModule} from "@spica-server/passport-testing";
import {PreferenceTestingModule} from "@spica-server/preference-testing";

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

describe("EnvVar Realtime on PostgreSQL", () => {
  let wsc: Websocket;
  let app: INestApplication;
  let req: Request;
  let opened: {readyState: number; close(): Promise<unknown>}[];

  const insertEnvVar = (document: object) =>
    req.post("/env-var", document).then(response => response.body);

  async function connect(query?: {[k: string]: string | number}) {
    const messages: any[] = [];
    const ws = wsc.get(url("/env-var", query), {headers: {Authorization: "APIKEY test"}});
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
        EnvVarModule.forRoot({realtime: true}),
        PassportTestingModule.initialize({overriddenStrategyType: "APIKEY"})
      ]
    }).compile();
    module.enableShutdownHooks();
    wsc = module.get(Websocket);
    req = module.get(Request);
    app = module.createNestApplication();
    app.useWebSocketAdapter(new WsAdapter(app));
    await app.listen(wsc.socket);

    jest
      .spyOn(app.get(GuardService), "checkAuthorization")
      .mockImplementation(({request}: {request: any}) => {
        request.resourceFilter = {include: [], exclude: []};
        return Promise.resolve(true);
      });
  });

  afterEach(async () => {
    await Promise.all(opened.filter(ws => ws.readyState <= 1).map(ws => ws.close()));
    await app.close();
  });

  it("should do the initial sync", async () => {
    await insertEnvVar({key: "A", value: "1"});
    await insertEnvVar({key: "B", value: "2"});

    const messages = await connect();

    expect(kinds(messages)).toEqual(["Initial", "Initial", "EndOfInitial"]);
    expect(
      messages
        .slice(0, 2)
        .map(message => message.document.key)
        .sort()
    ).toEqual(["A", "B"]);
  });

  it("should do the initial sync with a sort, a skip and a limit", async () => {
    await insertEnvVar({key: "C", value: "1"});
    await insertEnvVar({key: "A", value: "1"});
    await insertEnvVar({key: "B", value: "1"});

    const messages = await connect({sort: JSON.stringify({key: 1}), skip: 1, limit: 1});

    expect(messages.map(message => message.document?.key)).toEqual(["B", undefined]);
  });

  it("should send what is inserted after the initial sync", async () => {
    const messages = await connect();

    const inserted = await insertEnvVar({key: "LATER", value: "1"});
    await until(() => messages.length > 1);

    expect(messages).toEqual([
      {kind: ChunkKind.EndOfInitial},
      {kind: ChunkKind.Insert, document: expect.objectContaining({_id: inserted._id})}
    ]);
  });

  it("should send what is deleted", async () => {
    const inserted = await insertEnvVar({key: "GONE", value: "1"});
    const messages = await connect();

    await req.delete(`/env-var/${inserted._id}`);
    await until(() => messages.length > 2);

    expect(kinds(messages)).toEqual(["Initial", "EndOfInitial", "Delete"]);
    expect(messages[2].document).toEqual({_id: inserted._id});
  });
});
