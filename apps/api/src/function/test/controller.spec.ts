import {Test} from "@nestjs/testing";
import {FunctionModule} from "@spica-server/function";
import os from "os";
import {INestApplication} from "@nestjs/common";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database/testing";
import {SchemaModule} from "@spica-server/core/schema";
import {OBJECTID_STRING, OBJECT_ID} from "@spica-server/core/schema/formats";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";

describe("Function Controller", () => {
  let app: INestApplication;
  let request: Request;
  const fnSchema = {
    name: "test",
    description: "test",
    language: "javascript",
    timeout: 10,
    triggers: {
      http: {
        options: {
          method: "Get",
          path: "/test",
          preflight: true
        },
        type: "http",
        active: true
      }
    }
  };

  beforeEach(async () => {
    process.env.FUNCTION_GRPC_ADDRESS = "0.0.0.0:38653";
    const module = await Test.createTestingModule({
      imports: [
        CoreTestingModule,
        DatabaseTestingModule.replicaSet(),
        PreferenceTestingModule,
        PassportTestingModule.initialize({overriddenStrategyType: "JWT"}),
        SchemaModule.forRoot({formats: [OBJECT_ID, OBJECTID_STRING]}),
        FunctionModule.forRoot({
          invocationLogs: false,
          path: os.tmpdir(),
          databaseName: undefined,
          databaseReplicaSet: undefined,
          databaseUri: undefined,
          apiUrl: undefined,
          timeout: 10,
          corsOptions: {
            allowCredentials: true,
            allowedHeaders: ["*"],
            allowedMethods: ["*"],
            allowedOrigins: ["*"]
          },
          logExpireAfterSeconds: 60,
          entryLimit: 20,
          maxConcurrency: 1,
          debug: false,
          realtimeLogs: false,
          logger: false,
          spawnEntrypointPath: process.env.FUNCTION_SPAWN_ENTRYPOINT_PATH,
          tsCompilerPath: process.env.FUNCTION_TS_COMPILER_PATH,
          realtime: false
        })
      ]
    }).compile();

    request = module.get(Request);
    app = module.createNestApplication();
    await app.listen(request.socket);
  });

  afterEach(async () => await app.close());

  describe("filtering", () => {
    it("should filter functions by index", async () => {
      const fn1 = await request.post("/function", fnSchema).then(r => r.body);
      await request.post(`/function/${fn1._id}/index`, {
        index: `
  export function findMe(){ 
    return 'OK' ;
  }`
      });

      const fn2 = await request.post("/function", fnSchema).then(r => r.body);
      await request.post(`/function/${fn2._id}/index`, {
        index: `
  export function dontFindMe(){ 
    return 'OK' ;
  }`
      });

      const foundFns = await request
        .get("/function", {filter: JSON.stringify({index: "findMe\\("})})
        .then(r => r.body);
      expect(foundFns).toEqual([{...fn1, env_vars: []}]);
    });

    it("should throw bad request exception if filter is mistaken", async () => {
      const fn1 = await request.post("/function", fnSchema).then(r => r.body);
      await request.post(`/function/${fn1._id}/index`, {
        index: `
  export function findMe(){ 
    return 'OK' ;
  }`
      });

      // notice no escape characters("\\") for special characters("(")
      const body = await request
        .get("/function", {filter: JSON.stringify({index: "findMe("})})
        .then(r => r.body);
      expect(body.statusCode).toEqual(400);
      expect(body.error).toEqual("Bad Request");
      expect(body.message).toContain("Invalid regular expression");
    });
  });

  describe("endpoints", () => {
    it("should return information about enqueuers/runtimes and timeout", async () => {
      const res = await request.get("/function/information").then(r => r.body);
      expect(res).toBeDefined();
      expect(res.timeout).toEqual(10);

      const enqueuerTitles = res.enqueuers.map(e => e.description && e.description.title);
      const expectedEnqueuers = ["Http", "Firehose", "Database", "Scheduler", "System", "RabbitMQ"];
      expect(enqueuerTitles).toEqual(expect.arrayContaining(expectedEnqueuers));
      expect(enqueuerTitles.length).toEqual(expectedEnqueuers.length);

      const runtimeTitles = res.runtimes.map(r => r.title);
      expect(runtimeTitles).toEqual(expect.arrayContaining(["Node.js 22"]));
    });

    it("should return a function by id", async () => {
      const inserted = await request.post("/function", fnSchema).then(r => r.body);
      const found = await request.get(`/function/${inserted._id}`).then(r => r.body);
      expect(found).toEqual({...inserted, env_vars: []});
    });

    it("should delete a function and return 204", async () => {
      const inserted = await request.post("/function", fnSchema).then(r => r.body);
      const del = await request.delete(`/function/${inserted._id}`);
      expect(del.statusCode).toEqual(204);

      const getRes = await request.get(`/function/${inserted._id}`);
      expect(getRes.statusCode).toEqual(404);
      expect(getRes.body).toEqual({
        message: `Couldn't find the function with id ${inserted._id}`,
        statusCode: 404
      });
    });

    it("should replace a function via PUT and ignore language field", async () => {
      const inserted = await request.post("/function", fnSchema).then(r => r.body);

      const updated = {...inserted, name: "replaced-name", language: "typescript"};
      const putRes = await request.put(`/function/${inserted._id}`, updated);

      expect(putRes.statusCode).toEqual(200);

      const found = await request.get(`/function/${inserted._id}`).then(r => r.body);
      expect(found.name).toEqual("replaced-name");

      expect(found.language).toEqual(inserted.language);

      expect(found._id).toEqual(inserted._id);
    });

    it("should patch a function with merge-patch+json and validate content-type", async () => {
      const inserted = await request.post("/function", fnSchema).then(r => r.body);

      const wrong = await request
        .patch(`/function/${inserted._id}`, {category: "c1"})
        .then(r => r.body);
      expect(wrong.statusCode).toEqual(400);

      const success = await request.patch(
        `/function/${inserted._id}`,
        {category: "c1"},
        {"content-type": "application/merge-patch+json"}
      );
      expect(success.statusCode).toEqual(200);
    });

    it("should write and read function index (POST index -> 204, GET index -> index)", async () => {
      const inserted = await request.post("/function", fnSchema).then(r => r.body);
      const indexSource = `export function hello(){ return 'ok' }`;
      const postRes = await request.post(`/function/${inserted._id}/index`, {index: indexSource});
      expect([postRes.statusCode, postRes.statusText]).toEqual([204, "No Content"]);

      const show = await request.get(`/function/${inserted._id}/index`).then(r => r.body);
      expect(show.index).toContain("hello");
    });

    it("should return dependencies array (empty by default)", async () => {
      const inserted = await request.post("/function", fnSchema).then(r => r.body);
      const deps = await request.get(`/function/${inserted._id}/dependencies`).then(r => r.body);
      expect(Array.isArray(deps)).toBe(true);
    });

    it("should inject and eject env var", async () => {
      const inserted = await request.post("/function", fnSchema).then(r => r.body);
      const envVarId = new ObjectId().toHexString();

      const inj = await request.put(`/function/${inserted._id}/env-var/${envVarId}`);
      expect(inj.statusCode).toEqual(200);

      const ej = await request.delete(`/function/${inserted._id}/env-var/${envVarId}`);
      expect([ej.statusCode, ej.statusText]).toEqual([204, "No Content"]);
    });
  });

  describe("name uniqueness", () => {
    it("should not allow duplicate function names", async () => {
      //Wait a bit for before test for mongodb to create name indexes to resolve async process issues
      await new Promise(resolve => setTimeout(resolve, 2000));

      const fn = await request.post("/function", fnSchema).then(r => r.body);

      // attempt to create another function with same name
      const response = await request.post("/function", fnSchema).catch(e => e);

      expect([response.statusCode, response.statusText]).toEqual([400, "Bad Request"]);
      expect(response.body.message).toEqual(
        "Value of the property .name should unique across all documents."
      );
    });
  });
});
