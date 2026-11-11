import {randomUUID} from "node:crypto";
import {Test, TestingModule} from "@nestjs/testing";
import {FilterLanguageError, provideRepository} from "@spica-server/data";
import {DatabaseTestingModule} from "@spica-server/database-testing";
import {
  FUNCTION_LOG_OPTIONS,
  FUNCTION_LOG_SINK,
  LogSink
} from "@spica-server/interface-function-log";
import {
  ChunkKind,
  REALTIME,
  Realtime,
  RealtimeOptions,
  StreamChunk
} from "@spica-server/interface-realtime";

const SETTLE_MS = 600;
const [F1, F2, F3] = [randomUUID(), randomUUID(), randomUUID()];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function until(condition: () => boolean) {
  for (let waited = 0; waited < 15_000 && !condition(); waited += 25) {
    await sleep(25);
  }
}

describe("PostgreSQL realtime of system collections", () => {
  let module: TestingModule;
  let realtime: Realtime;
  let logs: LogSink;
  const subscriptions: {unsubscribe(): void}[] = [];

  async function open(name: string, options: RealtimeOptions = {}) {
    const chunks: StreamChunk<any>[] = [];
    const errors: any[] = [];
    subscriptions.push(
      realtime.find(name, options).subscribe({
        next: chunk => chunks.push(chunk),
        error: error => errors.push(error)
      })
    );
    await until(
      () => errors.length > 0 || chunks.some(chunk => chunk.kind == ChunkKind.EndOfInitial)
    );
    await sleep(SETTLE_MS);
    const mark = chunks.length;
    return {chunks, errors, live: () => chunks.slice(mark)};
  }

  const log = (row: object) =>
    logs.insert({
      function: F1,
      event_id: "e",
      channel: "stdout",
      level: 1,
      content: "hello",
      created_at: new Date(),
      ...row
    } as any);

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.postgres()],
      providers: [
        {provide: FUNCTION_LOG_OPTIONS, useValue: {expireAfterSeconds: 3600}},
        provideRepository(FUNCTION_LOG_SINK)
      ]
    }).compile();
    await module.init();
    realtime = module.get(REALTIME);
    logs = module.get(FUNCTION_LOG_SINK);
  }, 120_000);

  afterAll(() => module.close());

  afterEach(() => subscriptions.splice(0).forEach(subscription => subscription.unsubscribe()));

  describe("function logs", () => {
    const from = () => {
      const begin = new Date();
      begin.setMilliseconds(0);
      return begin;
    };
    const forever = new Date(8.64e15);

    it("should send only the logs from the beginning on", async () => {
      await log({content: "old", created_at: new Date(Date.now() - 60_000)});
      const begin = from();

      const stream = await open("function_logs", {createdBetween: {from: begin, to: forever}});
      await log({content: "new"});
      await until(() => stream.live().length > 0);

      expect(stream.chunks.filter(chunk => chunk.kind == ChunkKind.Initial)).toEqual([]);
      expect(stream.live().map(chunk => [ChunkKind[chunk.kind], chunk.document.content])).toEqual([
        ["Insert", "new"]
      ]);
    });

    it("should send only the logs of the functions asked for", async () => {
      const stream = await open("function_logs", {
        createdBetween: {from: from(), to: forever},
        where: {function: {in: [F1, F3]}}
      });

      await log({function: F1, content: "one"});
      await log({function: F2, content: "two"});
      await log({function: F3, content: "three"});
      await until(() => stream.live().length > 1);
      await sleep(SETTLE_MS);

      expect(stream.live().map(chunk => chunk.document.content)).toEqual(["one", "three"]);
    });

    it("should send only the logs whose content matches, regardless of case", async () => {
      const stream = await open("function_logs", {
        createdBetween: {from: from(), to: forever},
        where: {content: {matches: "ERR", caseInsensitive: true}}
      });

      await log({content: "all fine"});
      await log({content: "an Error happened"});
      await until(() => stream.live().length > 0);
      await sleep(SETTLE_MS);

      expect(stream.live().map(chunk => chunk.document.content)).toEqual(["an Error happened"]);
    });

    it("should not include a log the end of the range has passed", async () => {
      const stream = await open("function_logs", {
        createdBetween: {from: from(), to: new Date(Date.now() - 1000)}
      });

      await log({content: "late"});
      await sleep(SETTLE_MS);

      expect(stream.live()).toEqual([]);
    });
  });

  describe("a filter", () => {
    it("should be refused when it is a MongoDB filter", async () => {
      const {errors} = await open("function", {filter: {name: "x"}});

      expect(errors).toHaveLength(1);
      expect(errors[0]).toBeInstanceOf(FilterLanguageError);
    });

    it("should be refused when it is an expression about a field the collection lacks", async () => {
      const {errors} = await open("function", {filter: `document.nope == 1`});

      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({status: 400});
    });
  });

  describe("a collection that reports no changes", () => {
    it("should be refused", async () => {
      const {errors} = await open("jobs");

      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({status: 501});
    });
  });
});
