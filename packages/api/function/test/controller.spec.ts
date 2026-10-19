import {Test} from "@nestjs/testing";
import {FunctionModule} from "@spica-server/function";
import os from "os";
import fs from "fs";
import path from "path";
import {INestApplication} from "@nestjs/common";
import {CoreTestingModule, Request} from "@spica-server/core-testing";
import {Middlewares} from "@spica-server/core";
import {DatabaseTestingModule, ObjectId} from "@spica-server/database-testing";
import {SchemaModule} from "@spica-server/core-schema";
import {OBJECTID_STRING, OBJECT_ID} from "@spica-server/core-schema";
import {PassportTestingModule} from "@spica-server/passport-testing";
import {PreferenceTestingModule} from "@spica-server/preference-testing";
import {SecretModule} from "@spica-server/secret";
import {Scheduler, ScheduleWorker} from "@spica-server/function-scheduler";

describe("Function Controller", () => {
  let app: INestApplication;
  let request: Request;

  const assetsPath = fs.mkdtempSync(path.join(os.tmpdir(), "spica-fn-assets-"));
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
    process.env.FUNCTION_GRPC_ADDRESS = "0.0.0.0:38654";
    const module = await Test.createTestingModule({
      imports: [
        CoreTestingModule,
        DatabaseTestingModule.replicaSet(),
        PreferenceTestingModule,
        PassportTestingModule.initialize({overriddenStrategyType: "JWT"}),
        SchemaModule.forRoot({formats: [OBJECT_ID, OBJECTID_STRING]}),
        SecretModule.forRoot({
          realtime: false,
          encryptionSecret: "test-encryption-secret-32chars!!"
        }),
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
          maxWarmWorkers: 0,
          debug: false,
          realtimeLogs: false,
          logger: false,
          spawnEntrypointPath: process.env.FUNCTION_SPAWN_ENTRYPOINT_PATH,
          tsCompilerPath: process.env.FUNCTION_TS_COMPILER_PATH,
          realtime: false,
          assetStorage: {strategy: "default", defaultPath: assetsPath}
        })
      ]
    }).compile();

    request = module.get(Request);
    app = module.createNestApplication();
    app.use(Middlewares.MergePatchJsonParser(10));
    await app.listen(request.socket);
  });

  afterEach(async () => await app.close().catch(console.error));

  afterAll(() => fs.rmSync(assetsPath, {recursive: true, force: true}));

  describe("filtering", () => {
    it("should filter functions by index", async () => {
      const fn1 = await request
        .post("/function", {...fnSchema, name: "test_fn1"})
        .then(r => r.body);

      const response = await request.post(`/function/${fn1._id}/index`, {
        index: `
  export function findMe(){ 
    return 'OK' ;
  }`
      });

      const fn2 = await request
        .post("/function", {...fnSchema, name: "test_fn2"})
        .then(r => r.body);
      await request.post(`/function/${fn2._id}/index`, {
        index: `
  export function dontFindMe(){ 
    return 'OK' ;
  }`
      });

      const foundFns = await request
        .get("/function", {filter: JSON.stringify({index: "findMe\\("})})
        .then(r => r.body);
      expect(foundFns).toEqual([{...fn1, env_vars: [], secrets: []}]);
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
      const expectedEnqueuers = [
        "Http",
        "Firehose",
        "Database",
        "Scheduler",
        "System",
        "RabbitMQ",
        "gRPC"
      ];
      expect(enqueuerTitles).toEqual(expect.arrayContaining(expectedEnqueuers));
      expect(enqueuerTitles.length).toEqual(expectedEnqueuers.length);

      const runtimeTitles = res.runtimes.map(r => r.title);
      expect(runtimeTitles).toEqual(expect.arrayContaining(["Node.js 22"]));
    });

    it("should return a function by id", async () => {
      const inserted = await request.post("/function", fnSchema).then(r => r.body);
      const found = await request.get(`/function/${inserted._id}`).then(r => r.body);
      expect(found).toEqual({...inserted, env_vars: [], secrets: []});
    });

    it("should insert a helper function that has no triggers", async () => {
      const {triggers, ...helper} = fnSchema;
      const res = await request.post("/function", {...helper, name: "helper"});

      expect(res.statusCode).toEqual(201);
      expect(res.body._id).toBeDefined();

      const found = await request.get(`/function/${res.body._id}`).then(r => r.body);
      expect(found.name).toEqual("helper");
      expect(found.triggers).toBeUndefined();
    });

    it("should insert a helper function with an empty triggers object", async () => {
      const res = await request.post("/function", {...fnSchema, name: "helper", triggers: {}});

      expect(res.statusCode).toEqual(201);
      expect(res.body.triggers).toEqual({});
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

    it("should apply the patch without dropping injected relations", async () => {
      const secret = await request
        .post("/secret", {key: "MY_SECRET", value: "super-secret-value"})
        .then(r => r.body);

      const inserted = await request.post("/function", fnSchema).then(r => r.body);
      await request.put(`/function/${inserted._id}/secret/${secret._id}`);

      const res = await request.patch(
        `/function/${inserted._id}`,
        {category: "c1", order: 3},
        {"content-type": "application/merge-patch+json"}
      );
      expect(res.statusCode).toEqual(200);

      const found = await request.get(`/function/${inserted._id}`).then(r => r.body);

      expect(found.category).toEqual("c1");
      expect(found.order).toEqual(3);
      expect(found.secrets.map(s => s._id)).toEqual([secret._id]);
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

    it("should inject and eject secret", async () => {
      const inserted = await request.post("/function", fnSchema).then(r => r.body);
      const secretId = new ObjectId().toHexString();

      const inj = await request.put(`/function/${inserted._id}/secret/${secretId}`);
      expect(inj.statusCode).toEqual(200);

      const ej = await request.delete(`/function/${inserted._id}/secret/${secretId}`);
      expect([ej.statusCode, ej.statusText]).toEqual([204, "No Content"]);
    });

    it("should not return secret value when getting function with injected secret", async () => {
      const secret = await request
        .post("/secret", {key: "MY_SECRET", value: "super-secret-value"})
        .then(r => r.body);

      const inserted = await request.post("/function", fnSchema).then(r => r.body);

      await request.put(`/function/${inserted._id}/secret/${secret._id}`);

      const found = await request.get(`/function/${inserted._id}`).then(r => r.body);
      const secrets = found.secrets.map(({updated_at, ...rest}) => rest);
      expect(secrets).toEqual([{_id: secret._id, key: "MY_SECRET"}]);
      expect(found.secrets[0].value).toBeUndefined();
    });
  });

  describe("rename", () => {
    const functionsRoot = path.join(os.tmpdir(), "functions");
    const unique = (prefix: string) => `${prefix}_${new ObjectId().toHexString()}`;

    async function createWithIndex(name: string, index: string) {
      const fn = await request.post("/function", {...fnSchema, name}).then(r => r.body);
      await request.post(`/function/${fn._id}/index`, {index});
      return fn;
    }

    it("should move the code, dependencies and stored assets to the new name", async () => {
      const oldName = unique("before");
      const newName = unique("after");
      const fn = await createWithIndex(oldName, `export function http(){ return "renamed" }`);

      const res = await request.put(`/function/${fn._id}`, {...fn, name: newName});
      expect(res.statusCode).toEqual(200);

      const show = await request.get(`/function/${fn._id}/index`).then(r => r.body);
      expect(show.index).toContain("renamed");

      const deps = await request.get(`/function/${fn._id}/dependencies`);
      expect(deps.statusCode).toEqual(200);

      expect(fs.existsSync(path.join(functionsRoot, oldName))).toBe(false);
      expect(fs.existsSync(path.join(functionsRoot, newName, "index.mjs"))).toBe(true);

      expect(fs.existsSync(path.join(assetsPath, "functions", oldName, "index.mjs"))).toBe(false);
      expect(fs.existsSync(path.join(assetsPath, "functions", oldName, "package.json"))).toBe(
        false
      );
      expect(fs.readdirSync(path.join(assetsPath, "functions", newName)).sort()).toEqual([
        "index.mjs",
        "package.json"
      ]);
    });

    it("should keep editing the code after a rename", async () => {
      const fn = await createWithIndex(unique("before"), `export function http(){ return 1 }`);
      const newName = unique("after");
      await request.put(`/function/${fn._id}`, {...fn, name: newName});

      const write = await request.post(`/function/${fn._id}/index`, {
        index: `export function http(){ return "edited" }`
      });
      expect(write.statusCode).toEqual(204);

      const show = await request.get(`/function/${fn._id}/index`).then(r => r.body);
      expect(show.index).toContain("edited");
      expect(fs.existsSync(path.join(functionsRoot, newName, "package.json"))).toBe(true);
      expect(
        fs.readFileSync(path.join(assetsPath, "functions", newName, "index.mjs"), "utf-8")
      ).toContain("edited");
    });

    it("should serve the http trigger from the renamed function's code", async () => {
      const respondWith = (text: string) =>
        `export function http(req, res){ return res.status(200).send("${text}"); }`;
      const fn = await createWithIndex(unique("before"), respondWith("before rename"));
      await request.put(`/function/${fn._id}`, {...fn, name: unique("after")});
      await request.post(`/function/${fn._id}/index`, {index: respondWith("after rename")});

      const res = await request.get("/fn-execute/test");
      expect([res.statusCode, res.body]).toEqual([200, "after rename"]);
    });

    it("should reject renaming to a taken name and leave the function as it was", async () => {
      await new Promise(resolve => setTimeout(resolve, 2000));

      const taken = await createWithIndex(unique("taken"), `export function http(){}`);
      const oldName = unique("before");
      const fn = await createWithIndex(oldName, `export function http(){ return "kept" }`);

      const res = await request.put(`/function/${fn._id}`, {...fn, name: taken.name}).catch(e => e);
      expect(res.statusCode).toEqual(400);

      const found = await request.get(`/function/${fn._id}`).then(r => r.body);
      expect(found.name).toEqual(oldName);
      const show = await request.get(`/function/${fn._id}/index`).then(r => r.body);
      expect(show.index).toContain("kept");
    });
  });

  // A worker caches the code of the functions it imports on first execution, so these prove that
  // saving an imported function retires the stale workers of everything importing it.
  describe("importers", () => {
    const unique = (prefix: string) => `${prefix}_${new ObjectId().toHexString()}`;

    let timeoutSpy: jest.SpyInstance;
    let supersedeSpy: jest.SpyInstance;

    beforeEach(() => {
      timeoutSpy = jest.spyOn(ScheduleWorker.prototype, "markAsTimeouted");
      supersedeSpy = jest.spyOn(Scheduler.prototype, "supersedeWorkers");
    });

    afterEach(() => jest.restoreAllMocks());

    async function createHelper(name: string, value: string) {
      const fn = await request
        .post("/function", {...fnSchema, name, triggers: {}})
        .then(r => r.body);
      await writeHelper(fn, value);
      return fn;
    }

    function writeHelper(fn, value: string) {
      return request.post(`/function/${fn._id}/index`, {
        index: `export const value = () => "${value}";`
      });
    }

    async function createImporter(name: string, imported: string, httpPath?: string) {
      const triggers = httpPath
        ? {
            http: {
              ...fnSchema.triggers.http,
              options: {...fnSchema.triggers.http.options, path: httpPath}
            }
          }
        : {};
      // The worker that served the old code sits outdated after the cutover and is only reaped
      // by its last event's timeout timer, which app.close() waits for; keep it short.
      const fn = await request
        .post("/function", {...fnSchema, name, triggers, timeout: 3})
        .then(r => r.body);

      const install = await request.post(`/function/${fn._id}/dependencies`, {
        name: [`@spica-fn/${imported}`]
      });
      expect(install.statusCode).toEqual(201);

      const respond = httpPath
        ? `export function http(req, res){ return res.status(200).send(value()); }`
        : `export {value};`;
      await request.post(`/function/${fn._id}/index`, {
        index: `import {value} from "@spica-fn/${imported}";\n${respond}`
      });
      return fn;
    }

    const execute = (httpPath: string) =>
      request.get(`/fn-execute${httpPath}`).then(res => [res.statusCode, res.body]);

    // Superseded workers keep serving until their fresh replacements are ready (rolling cutover),
    // so the new code shows up shortly after the save rather than on the very next request.
    async function executeUntil(httpPath: string, expected: string, timeoutMs = 10_000) {
      const deadline = Date.now() + timeoutMs;
      let last = await execute(httpPath);
      while (last[1] != expected && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 250));
        last = await execute(httpPath);
      }
      return last;
    }

    // A worker killed by its own timeout timer gets replaced by a fresh one that loads the new code
    // from disk, which would pass without the fix. Prove the save retired the importer's workers.
    async function expectSaveToServeNewCode(helper, importer, httpPath: string) {
      supersedeSpy.mockClear();

      await writeHelper(helper, "v2");

      expect(supersedeSpy.mock.calls.map(([target]) => target.id)).toContain(importer._id);
      expect(await executeUntil(httpPath, "v2")).toEqual([200, "v2"]);
      expect(timeoutSpy).not.toHaveBeenCalled();
    }

    it("should serve the new code of a directly imported function after it is saved", async () => {
      const helper = await createHelper(unique("helper"), "v1");
      const importer = await createImporter(unique("importer"), helper.name, "/direct");

      expect(await execute("/direct")).toEqual([200, "v1"]);

      await expectSaveToServeNewCode(helper, importer, "/direct");
    });

    it("should serve the new code of an indirectly imported function after it is saved", async () => {
      const helper = await createHelper(unique("helper"), "v1");
      const middle = await createImporter(unique("middle"), helper.name);
      const top = await createImporter(unique("top"), middle.name, "/indirect");

      expect(await execute("/indirect")).toEqual([200, "v1"]);

      await expectSaveToServeNewCode(helper, top, "/indirect");
    });
  });

  describe("name operations", () => {
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
    it("should allow function names with underscores", async () => {
      const fn = await request
        .post("/function", {
          ...fnSchema,
          name: "function_with_underscores"
        })
        .then(r => r.body);

      expect(fn.name).toEqual("function_with_underscores");
    });

    it("should allow function names with hyphens", async () => {
      const fn = await request
        .post("/function", {
          ...fnSchema,
          name: "function-with-hyphens"
        })
        .then(r => r.body);

      expect(fn.name).toEqual("function-with-hyphens");
    });

    it("should not allow special characters in function name", async () => {
      const response = await request
        .post("/function", {
          ...fnSchema,
          name: "user function"
        })
        .catch(e => e);

      expect(response.body).toEqual({
        message: '.name must match pattern "^[\\w-]+$"',
        error: "validation failed",
        statusCode: 400
      });
    });
  });
});
