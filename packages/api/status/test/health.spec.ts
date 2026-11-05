import {INestApplication} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {CoreTestingModule, Request} from "@spica-server/core-testing";
import {contractSuite} from "@spica-server/database-testing";
import {DATA_HEALTH, DataHealth} from "@spica-server/interface-data";
import {PassportTestingModule} from "@spica-server/passport-testing";
import {StatusModule} from "@spica-server/status";

contractSuite("Health Check Endpoints", engine => {
  let module: TestingModule;
  let app: INestApplication;
  let req: Request;
  let health: DataHealth;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        engine.module(),
        StatusModule.forRoot({expireAfterSeconds: 60}),
        CoreTestingModule,
        PassportTestingModule.initialize()
      ]
    }).compile();

    app = module.createNestApplication();
    req = module.get(Request);
    health = module.get(DATA_HEALTH);
    await app.listen(req.socket);
  });

  afterEach(async () => await app.close());

  it("GET /status/live should return 200 without authentication", async () => {
    const res = await req.get("/status/live");
    expect([res.statusCode, res.statusText]).toEqual([200, "OK"]);
    expect(res.body).toEqual({status: "ok"});
  });

  it("GET /status/engine should name the engine, and not be read as a module", async () => {
    const res = await req.get("/status/engine");
    expect([res.statusCode, res.body]).toEqual([200, {engine: engine.name}]);
  });

  it("GET /status/ready should return 200 when database is connected", async () => {
    const res = await req.get("/status/ready");
    expect([res.statusCode, res.statusText]).toEqual([200, "OK"]);
    expect(res.body).toEqual({status: "ok"});
  });

  it("GET /status/ready should return Service Unavailable when database is not ready", async () => {
    jest.spyOn(health, "ping").mockRejectedValueOnce(new Error("Database is not ready"));
    const res = await req.get("/status/ready");
    expect([res.statusCode, res.statusText]).toEqual([503, "Service Unavailable"]);
  });
});
