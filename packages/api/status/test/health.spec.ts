import {INestApplication} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {CoreTestingModule, Request} from "@spica-server/core-testing";
import {DatabaseService, DatabaseTestingModule} from "@spica-server/database-testing";
import {PassportTestingModule} from "@spica-server/passport-testing";
import {StatusModule} from "@spica-server/status";

describe("Health Check Endpoints", () => {
  let module: TestingModule;
  let app: INestApplication;
  let req: Request;
  let db: DatabaseService;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        DatabaseTestingModule.replicaSet(),
        StatusModule.forRoot({expireAfterSeconds: 60}),
        CoreTestingModule,
        PassportTestingModule.initialize()
      ]
    }).compile();

    app = module.createNestApplication();
    req = module.get(Request);
    db = module.get(DatabaseService);
    await app.listen(req.socket);
  });

  afterEach(async () => await app.close());

  it("GET /status/live should return 200 without authentication", async () => {
    const res = await req.get("/status/live");
    expect([res.statusCode, res.statusText]).toEqual([200, "OK"]);
    expect(res.body).toEqual({status: "ok"});
  });

  it("GET /status/ready should return 200 when database is connected", async () => {
    const res = await req.get("/status/ready");
    expect([res.statusCode, res.statusText]).toEqual([200, "OK"]);
    expect(res.body).toEqual({status: "ok"});
  });

  it("GET /status/ready should return Service Unavailable when database is not ready", async () => {
    // mock database ping command to throw an error
    jest.spyOn(db, "command").mockRejectedValueOnce(new Error("Database is not ready"));
    const res = await req.get("/status/ready");
    expect([res.statusCode, res.statusText]).toEqual([503, "Service Unavailable"]);
  });
});
