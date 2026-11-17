import {INestApplication} from "@nestjs/common";
import {Test, TestingModule} from "@nestjs/testing";
import {CoreTestingModule, Request} from "@spica-server/core-testing";
import {clearStorage, contractSuite} from "@spica-server/database-testing";
import {PREFERENCE_REPOSITORY, PreferenceRepository} from "@spica-server/interface-preference";
import {PassportTestingModule} from "@spica-server/passport-testing";
import {PreferenceModule} from "@spica-server/preference";

contractSuite("PreferenceController", engine => {
  let module: TestingModule;
  let app: INestApplication;
  let req: Request;

  function addpref(pref: any) {
    return module.get<PreferenceRepository>(PREFERENCE_REPOSITORY).insert(pref);
  }

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        engine.module(),
        PassportTestingModule.initialize(),
        PreferenceModule.forRoot(),
        CoreTestingModule
      ],
      providers: []
    }).compile();
    app = module.createNestApplication();
    req = module.get(Request);
    await app.listen(req.socket);
  }, 120000);

  afterEach(() =>
    clearStorage(engine, module, {mongodb: ["preferences"], postgresql: ["preferences"]})
  );

  afterAll(async () => await app.close());

  it("should get preference", async () => {
    await req.put("/preference/bucket", {scope: "bucket", property: "bucket props"});
    await req.put("/preference/function", {scope: "function", property: "function props"});

    const bucketPref = (await req.get("/preference/bucket", {})).body;
    expect(bucketPref.scope).toBe("bucket");
    expect(bucketPref.property).toBe("bucket props");

    const functionPref = (await req.get("/preference/function", {})).body;
    expect(functionPref.property).toBe("function props");
    expect(functionPref.property).toBe("function props");
  });

  it("should update preference", async () => {
    await addpref({scope: "bucket", property: "bucket props"});

    await req.put("/preference/bucket", {scope: "bucket", property: "new bucket props"});

    const myUpdatedPref = (await req.get("/preference/bucket", {})).body;
    expect(myUpdatedPref.scope).toBe("bucket");
    expect(myUpdatedPref.property).toBe("new bucket props");
  });
});
