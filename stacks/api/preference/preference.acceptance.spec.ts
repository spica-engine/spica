import {Test, TestingModule} from "@nestjs/testing";
import {DatabaseTestingModule, DatabaseService, ObjectId} from "@spica-server/database/testing";
import {Preference} from "./interface";
import {Observable} from "rxjs";
import {PreferenceModule} from "./preference.module";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {INestApplication} from "@nestjs/common";
import {Middlewares} from "@spica-server/core";

jasmine.DEFAULT_TIMEOUT_INTERVAL = 120000;

describe("Preference Service", () => {
  let module: TestingModule;
  let app: INestApplication;
  let req: Request;

  async function addpref(pref: any) {
    await app
      .get(DatabaseService)
      .collection("preferences")
      .insertOne(pref)
      .catch();
  }

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [DatabaseTestingModule.replicaSet(), PreferenceModule, CoreTestingModule],
      providers: []
    }).compile();
    app = module.createNestApplication();
    app.use(Middlewares.BsonBodyParser);
    req = module.get(Request);
    await app.listen(req.socket);
  });

  afterEach(async () => {
    await app
      .get(DatabaseService)
      .collection("preferences")
      .deleteMany({})
      .catch();
  });

  afterAll(async () => {
    await app.close();
  });

  it("should get preference", async () => {
    await req.post("/preference", 
      {scope: "bucket", property: "bucket props"},
    );
    await req.post("/preference", 
      {scope: "function", property: "function props"},
    );

    const bucketPref = (await req.get("/preference/bucket", {})).body;
    expect(bucketPref.scope).toBe("bucket");
    expect(bucketPref.property).toBe("bucket props");

    const functionPref = (await req.get("/preference/function", {})).body;
    expect(functionPref.property).toBe("function props");
    expect(functionPref.property).toBe("function props");
  });

  it("should add preference", async () => {
    const response = await req.post("/preference", {scope: "bucket", property: "bucket props"});
    expect([response.statusCode, response.statusText]).toEqual([201, "Created"]);
  });

  it("should update preference", async () => {
    await addpref({scope: "bucket", property: "bucket props"});

    await req.post("/preference", {scope: "bucket", property: "new bucket props"});

    const myUpdatedPref = (await req.get("/preference/bucket", {})).body;
    expect(myUpdatedPref.scope).toBe("bucket");
    expect(myUpdatedPref.property).toBe("new bucket props");
  });
});
