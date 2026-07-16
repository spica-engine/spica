import {INestApplication} from "@nestjs/common";
import {Test} from "@nestjs/testing";
import {LogModule} from "@spica-server/function-log";
import {CoreTestingModule, Request} from "@spica-server/core-testing";
import {DatabaseService, ObjectId} from "@spica-server/database";
import {DatabaseTestingModule} from "@spica-server/database-testing";
import {PassportTestingModule} from "@spica-server/passport-testing";

describe("Log Controller", () => {
  let app: INestApplication;
  let req: Request;
  let db: DatabaseService;

  const fnId = new ObjectId();
  const deletedFnId = new ObjectId();

  // _id encodes the timestamp, and the controller filters/sorts on it, so logs have to be seeded
  // with ids built from a known second rather than freshly generated ones.
  const day = Math.floor(new Date("2024-01-02T00:00:00.000Z").getTime() / 1000);
  const logId = (offsetSeconds: number, counter: number) =>
    new ObjectId(
      (day + offsetSeconds).toString(16).padStart(8, "0") + counter.toString(16).padStart(16, "0")
    );

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        DatabaseTestingModule.replicaSet(),
        CoreTestingModule,
        LogModule.forRoot({expireAfterSeconds: 60, realtime: false}),
        PassportTestingModule.initialize()
      ]
    }).compile();

    app = module.createNestApplication();
    req = module.get(Request);
    db = module.get(DatabaseService);
    await app.listen(req.socket);
  });

  afterAll(() => app.close());

  beforeEach(async () => {
    await db.collection("function").insertMany([{_id: fnId, name: "my-fn"}]);
    await db.collection("function_logs").insertMany([
      {
        _id: logId(1, 1),
        function: fnId.toString(),
        event_id: "event",
        channel: "stdout",
        level: 1,
        content: "first",
        created_at: new Date()
      },
      {
        _id: logId(2, 2),
        function: fnId.toString(),
        event_id: "event",
        channel: "stdout",
        level: 1,
        content: "second",
        created_at: new Date()
      },
      {
        _id: logId(3, 3),
        function: deletedFnId.toString(),
        event_id: "event",
        channel: "stdout",
        level: 1,
        content: "orphan",
        created_at: new Date()
      }
    ]);
  });

  afterEach(async () => {
    await db.collection("function").deleteMany({});
    await db.collection("function_logs").deleteMany({});
  });

  const list = (query: object = {}) =>
    req.get("/function-logs", {
      begin: new Date(day * 1000).toISOString(),
      end: new Date((day + 3600) * 1000).toISOString(),
      ...query
    });

  it("should replace the function id with the function name, newest first", async () => {
    const res = await list();

    expect(res.body.map(log => [log.content, log.function])).toEqual([
      ["orphan", deletedFnId.toString()],
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
    const res = await list({functions: [fnId.toString()]});

    expect(res.body.map(log => log.content)).toEqual(["second", "first"]);
  });
});
