import {randomUUID} from "node:crypto";
import {INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {CoreTestingModule, Websocket} from "@spica-server/core-testing";
import {WsAdapter} from "@spica-server/core-websocket";
import {provideRepository} from "@spica-server/data";
import {DatabaseTestingModule} from "@spica-server/database-testing";
import {LogModule} from "@spica-server/function-log";
import {FUNCTION_LOG_SINK, LogSink} from "@spica-server/interface-function-log";
import {ChunkKind} from "@spica-server/interface-realtime";
import {PassportTestingModule} from "@spica-server/passport-testing";

jest.setTimeout(60_000);

function url(path: string, query?: {[k: string]: string | string[]}) {
  const target = new URL(path, "ws://insteadof");
  for (const key in query) {
    const value = query[key];
    (Array.isArray(value) ? value : [value]).forEach(item => target.searchParams.append(key, item));
  }
  return `${target.pathname}${target.search}`;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function until(condition: () => boolean) {
  for (let waited = 0; waited < 15_000 && !condition(); waited += 25) {
    await sleep(25);
  }
}

describe("Function log Realtime on PostgreSQL", () => {
  let wsc: Websocket;
  let app: INestApplication;
  let sink: LogSink;
  let opened: {readyState: number; close(): Promise<unknown>}[];
  const [fn1, fn2] = [randomUUID(), randomUUID()];

  const log = (row: object) =>
    sink.insert({
      function: fn1,
      event_id: "event",
      channel: "stdout",
      level: 1,
      content: "hello",
      created_at: new Date(),
      ...row
    } as any);

  async function connect(query: {[k: string]: string | string[]} = {}) {
    const messages: any[] = [];
    const ws = wsc.get(url("/function-logs", query));
    opened.push(ws);
    ws.onmessage = event => messages.push(JSON.parse(event.data as string));
    await ws.connect;
    await until(() => messages.some(message => message.kind == ChunkKind.EndOfInitial));
    await sleep(300);
    return messages;
  }

  const contents = (messages: any[]) => messages.map(message => message.document?.content);

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        DatabaseTestingModule.postgres(),
        CoreTestingModule,
        LogModule.forRoot({expireAfterSeconds: 60, realtime: true}),
        PassportTestingModule.initialize()
      ],
      providers: [provideRepository(FUNCTION_LOG_SINK)]
    }).compile();
    module.enableShutdownHooks();
    sink = module.get(FUNCTION_LOG_SINK);
    wsc = module.get(Websocket);
    app = module.createNestApplication();
    app.useWebSocketAdapter(new WsAdapter(app));
    await app.listen(wsc.socket);
  });

  afterAll(() => app.close());

  beforeEach(() => {
    opened = [];
  });

  afterEach(() => Promise.all(opened.filter(ws => ws.readyState <= 1).map(ws => ws.close())));

  it("should send the logs from the beginning on, and then what is logged", async () => {
    await log({content: "before", created_at: new Date(Date.now() - 60_000)});
    const begin = new Date(Date.now() - 5000).toISOString();
    await log({content: "after the beginning"});

    const messages = await connect({begin});
    await log({content: "live"});
    await until(() => messages.length > 2);

    expect(messages.map(message => ChunkKind[message.kind])).toEqual([
      "Initial",
      "EndOfInitial",
      "Insert"
    ]);
    expect(contents(messages)).toEqual(["after the beginning", undefined, "live"]);
  });

  it("should send only the logs of the functions asked for", async () => {
    const messages = await connect({functions: [fn1]});

    await log({function: fn1, content: "mine"});
    await log({function: fn2, content: "not mine"});
    await until(() => messages.length > 1);
    await sleep(500);

    expect(contents(messages)).toEqual([undefined, "mine"]);
  });

  it("should send only the logs whose content matches, regardless of case", async () => {
    const messages = await connect({content: "ABORT"});

    await log({content: "all fine"});
    await log({content: "Function (default) did not finish. Aborting."});
    await until(() => messages.length > 1);
    await sleep(500);

    expect(contents(messages)).toEqual([undefined, "Function (default) did not finish. Aborting."]);
  });
});
