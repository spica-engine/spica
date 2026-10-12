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

  /**
   * The capability declaration endpoint (K-10, Phase 6 slice 6c).
   *
   * The panel reads it and hides the interfaces that have no counterpart. What the test really verifies
   * is that the `backend` field comes **from the real driver**: were a fixed value returned, the panel
   * would show the wrong interface and the difference would only surface when a user tried a feature and
   * broke it.
   */
  it("GET /status/capabilities returns the driver's declaration", async () => {
    const res = await req.get("/status/capabilities");
    expect(res.statusCode).toBe(200);

    // Not a fixed string: comparing against the injected driver is what proves the endpoint reads the
    // real declaration. A hardcoded value in the controller passes on one leg and fails on the other.
    expect(res.body.backend).toBe(db.capabilities.backend);
    expect(res.body.database).toBe(db.databaseName);

    // K-10: differences are not silent, they are declared. The literal values are written out per
    // backend so that a driver quietly flipping one of them fails here.
    const declared = {
      mongodb: {nativeTTLIndex: true, requiresReplicaSet: true, referentialIntegrity: false},
      postgres: {nativeTTLIndex: false, requiresReplicaSet: false, referentialIntegrity: true}
    };
    expect(declared[db.capabilities.backend]).toBeDefined();
    expect({
      nativeTTLIndex: res.body.capabilities.nativeTTLIndex,
      requiresReplicaSet: res.body.capabilities.requiresReplicaSet,
      referentialIntegrity: res.body.capabilities.referentialIntegrity
    }).toEqual(declared[db.capabilities.backend]);
  });

  it("GET /status/capabilities requires authentication", async () => {
    // Because `PassportTestingModule.initialize()` lets the guards through, only the endpoint's
    // reachability is verified here; the guard itself is exercised in the passport specs.
    const res = await req.get("/status/capabilities");
    expect(res.statusCode).not.toBe(404);
  });

  it("GET /status/ready should return Service Unavailable when database is not ready", async () => {
    // The health check now goes through the neutral `ping()` (Phase 6 slice 6a); it used to call
    // `command({ping: 1})`, and `command` is mongodb-specific.
    jest.spyOn(db, "ping").mockRejectedValueOnce(new Error("Database is not ready"));
    const res = await req.get("/status/ready");
    expect([res.statusCode, res.statusText]).toEqual([503, "Service Unavailable"]);
  });
});
