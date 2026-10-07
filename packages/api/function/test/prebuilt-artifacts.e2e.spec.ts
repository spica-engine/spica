import {Test} from "@nestjs/testing";
import {INestApplication} from "@nestjs/common";
import os from "os";
import fs from "fs";
import path from "path";
import {FunctionModule} from "@spica-server/function";
import {CoreTestingModule, Request} from "@spica-server/core-testing";
import {Middlewares} from "@spica-server/core";
import {
  DatabaseService,
  DatabaseTestingModule,
  getConnectionUri,
  ObjectId
} from "@spica-server/database-testing";
import {SchemaModule, OBJECTID_STRING, OBJECT_ID} from "@spica-server/core-schema";
import {PassportTestingModule} from "@spica-server/passport-testing";
import {PreferenceTestingModule} from "@spica-server/preference-testing";
import {SecretModule} from "@spica-server/secret";
import {Scheduler} from "@spica-server/function-scheduler";

describe("Prebuilt function artifacts", () => {
  const dbName = `prebuilt_artifacts_${new ObjectId().toHexString()}`;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "spica-prebuilt-"));
  const bucketPath = path.join(tmp, "bucket");

  let app: INestApplication;
  let request: Request;
  let db: DatabaseService;
  let scheduler: Scheduler;

  const fnSchema = {
    name: "prebuilt_fn",
    description: "prebuilt",
    language: "javascript",
    timeout: 10,
    triggers: {
      default: {
        options: {method: "Get", path: "/prebuilt", preflight: true},
        type: "http",
        active: false
      }
    }
  };

  async function boot(persistentPath: string, onCompiled?: () => void) {
    process.env.FUNCTION_GRPC_ADDRESS = "0.0.0.0:38655";
    const module = await Test.createTestingModule({
      imports: [
        CoreTestingModule,
        getConnectionUri()
          ? DatabaseTestingModule.connect(getConnectionUri(), dbName)
          : DatabaseTestingModule.replicaSet(dbName),
        PreferenceTestingModule,
        PassportTestingModule.initialize({overriddenStrategyType: "JWT"}),
        SchemaModule.forRoot({formats: [OBJECT_ID, OBJECTID_STRING]}),
        SecretModule.forRoot({
          realtime: false,
          encryptionSecret: "test-encryption-secret-32chars!!"
        }),
        FunctionModule.forRoot({
          invocationLogs: false,
          path: persistentPath,
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
          assetStorage: {strategy: "default", defaultPath: bucketPath, prebuiltArtifacts: true}
        })
      ]
    }).compile();

    request = module.get(Request);
    db = module.get(DatabaseService);
    scheduler = module.get(Scheduler);
    onCompiled?.();
    app = module.createNestApplication();
    app.use(Middlewares.MergePatchJsonParser(10));
    await app.listen(request.socket);
  }

  afterEach(async () => await app?.close().catch(console.error));

  afterAll(() => fs.rmSync(tmp, {recursive: true, force: true}));

  it("should publish an archive on write and restore it on a replica with an empty disk", async () => {
    const firstDisk = path.join(tmp, "first");
    await boot(firstDisk);

    const fn = await request.post("/function", fnSchema).then(r => r.body);
    const index = `export default function () { return "prebuilt"; }`;
    const res = await request.post(`/function/${fn._id}/index`, {index});
    expect(res.statusCode).toEqual(204);

    const artifacts = await db
      .collection("function_artifacts")
      .find({functionId: new ObjectId(fn._id)})
      .toArray();
    expect(artifacts).toHaveLength(1);
    const key = artifacts[0].key;
    expect(key).toMatch(/^functions\/prebuilt_fn\/artifacts\/[0-9a-f]{64}\.tar\.gz$/);
    expect(fs.existsSync(path.join(bucketPath, key))).toBe(true);

    const firstDir = path.join(firstDisk, "functions", fnSchema.name);
    expect(fs.readFileSync(path.join(firstDir, ".spica-artifact"), "utf-8")).toEqual(key);
    const builtIndex = fs.readFileSync(path.join(firstDir, ".build", "index.mjs"));

    await app.close();

    const secondDisk = path.join(tmp, "second");
    let build: jest.SpyInstance;
    let install: jest.SpyInstance;
    await boot(secondDisk, () => {
      build = jest.spyOn(scheduler.builders.get("javascript"), "build");
      install = jest.spyOn(scheduler.pkgmanagers.get("node"), "install");
    });

    const secondDir = path.join(secondDisk, "functions", fnSchema.name);
    expect(fs.readFileSync(path.join(secondDir, ".spica-artifact"), "utf-8")).toEqual(key);
    expect(fs.readFileSync(path.join(secondDir, ".build", "index.mjs"))).toEqual(builtIndex);
    expect(fs.readFileSync(path.join(secondDir, "index.mjs"), "utf-8")).toEqual(index);
    expect(build).not.toHaveBeenCalled();
    expect(install).not.toHaveBeenCalled();

    const shown = await request.get(`/function/${fn._id}/index`).then(r => r.body);
    expect(shown.index).toEqual(index);
  });
});
