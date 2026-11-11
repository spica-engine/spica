import {INestApplication} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {LogModule} from "@spica-server/function-log";
import {CoreTestingModule, Request} from "@spica-server/core-testing";
import {provideRepository, idOf} from "@spica-server/data";
import {clearStorage, contractSuite} from "@spica-server/database-testing";
import {ID_TYPES, IdTypes} from "@spica-server/interface-data";
import {
  FUNCTION_OPTIONS,
  FUNCTION_REPOSITORY,
  FunctionRepository
} from "@spica-server/interface-function";
import {FUNCTION_LOG_SINK, LogSink} from "@spica-server/interface-function-log";
import {PassportTestingModule} from "@spica-server/passport-testing";

const HOUR = 3600 * 1000;

contractSuite("Log Controller", engine => {
  let module: TestingModule;
  let app: INestApplication;
  let req: Request;
  let fnId: string;
  let deletedFnId: string;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        engine.module(),
        CoreTestingModule,
        LogModule.forRoot({expireAfterSeconds: 60, realtime: false}),
        PassportTestingModule.initialize()
      ],
      providers: [
        {provide: FUNCTION_OPTIONS, useValue: {entryLimit: 4}},
        provideRepository(FUNCTION_REPOSITORY),
        provideRepository(FUNCTION_LOG_SINK)
      ]
    }).compile();

    app = module.createNestApplication();
    req = module.get(Request);
    await app.listen(req.socket);
  });

  afterAll(() => app.close());

  beforeEach(async () => {
    const functions = module.get<FunctionRepository>(FUNCTION_REPOSITORY);
    const sink = module.get<LogSink>(FUNCTION_LOG_SINK);

    fnId = String(idOf(await functions.insert({name: "my-fn", language: "javascript"} as any)));
    deletedFnId = String(module.get<IdTypes>(ID_TYPES).unscoped().generate());

    for (const [content, fn] of [
      ["first", fnId],
      ["second", fnId],
      ["orphan", deletedFnId]
    ]) {
      await sink.insert({
        function: fn,
        event_id: "event",
        channel: "stdout",
        level: 1,
        content,
        created_at: new Date()
      } as any);
    }
  });

  afterEach(async () => {
    await clearStorage(engine, module, {
      mongodb: ["function", "function_logs"],
      postgresql: ["functions", "function_logs"]
    });
  });

  const list = (query: object = {}) =>
    req.get("/function-logs", {
      begin: new Date(Date.now() - HOUR).toISOString(),
      end: new Date(Date.now() + HOUR).toISOString(),
      ...query
    });

  it("should replace the function id with the function name, newest first", async () => {
    const res = await list();

    expect(res.body.map(log => [log.content, log.function])).toEqual([
      ["orphan", deletedFnId],
      ["second", "my-fn"],
      ["first", "my-fn"]
    ]);
  });

  it("should keep logs whose function no longer exists", async () => {
    const res = await list();

    expect(res.body.map(log => log.content)).toContain("orphan");
  });

  it("should apply limit against the newest logs, not an arbitrary subset", async () => {
    const res = await list({limit: 1});

    expect(res.body.map(log => log.content)).toEqual(["orphan"]);
  });

  it("should resolve the function name on a limited page", async () => {
    const res = await list({limit: 2, skip: 1});

    expect(res.body.map(log => [log.content, log.function])).toEqual([
      ["second", "my-fn"],
      ["first", "my-fn"]
    ]);
  });

  it("should filter by function", async () => {
    const res = await list({functions: [fnId]});

    expect(res.body.map(log => log.content)).toEqual(["second", "first"]);
  });
});
