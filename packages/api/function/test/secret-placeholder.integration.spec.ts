import {Test} from "@nestjs/testing";
import {INestApplication} from "@nestjs/common";
import os from "os";
import fs from "fs";
import path from "path";
import {FunctionModule} from "@spica-server/function";
import {Scheduler} from "@spica-server/function-scheduler";
import {CoreTestingModule, Request} from "@spica-server/core-testing";
import {DatabaseTestingModule} from "@spica-server/database-testing";
import {SchemaModule, OBJECTID_STRING, OBJECT_ID} from "@spica-server/core-schema";
import {PassportTestingModule} from "@spica-server/passport-testing";
import {PreferenceTestingModule} from "@spica-server/preference-testing";
import {SecretModule} from "@spica-server/secret";

describe("Function trigger secret placeholders", () => {
  let app: INestApplication;
  let request: Request;
  let scheduler: Scheduler;

  let subscribe: jest.SpyInstance;
  let unsubscribe: jest.SpyInstance;
  let reconcileContext: jest.SpyInstance;

  let functionsPath: string;
  const assetsPath = fs.mkdtempSync(path.join(os.tmpdir(), "spica-fn-assets-"));

  const PLACEHOLDER_URL =
    "amqp://${SECRET.RABBITMQ_USER}:${SECRET.RABBITMQ_PASSWORD}@localhost:5672";

  function rabbitmqFunction(url: string, extra: Record<string, unknown> = {}) {
    return {
      name: "consumer",
      description: "Secret placeholder test function",
      language: "javascript",
      timeout: 10,
      triggers: {
        default: {type: "rabbitmq", active: true, options: {url}}
      },
      ...extra
    };
  }

  async function insertSecret(key: string, value: string) {
    const res = await request.post("/secret", {key, value});
    expect(res.statusCode).toEqual(201);
    return res.body._id as string;
  }

  async function insertFunction(url = PLACEHOLDER_URL) {
    const res = await request.post("/function", rabbitmqFunction(url));
    expect(res.statusCode).toEqual(201);
    return res.body._id as string;
  }

  async function inject(fnId: string, secretId: string) {
    const res = await request.put(`/function/${fnId}/secret/${secretId}`);
    expect(res.statusCode).toEqual(200);
  }

  async function eject(fnId: string, secretId: string) {
    const res = await request.delete(`/function/${fnId}/secret/${secretId}`);
    expect(res.statusCode).toEqual(204);
  }

  function subscribedUrls() {
    return subscribe.mock.calls.map(([, options]) => options.url);
  }

  function expectResubscribed(url: string) {
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(subscribedUrls()).toEqual([url]);
    expect(unsubscribe.mock.invocationCallOrder[0]).toBeLessThan(
      subscribe.mock.invocationCallOrder[0]
    );
  }

  function expectNotResubscribed() {
    expect(subscribe).not.toHaveBeenCalled();
    expect(unsubscribe).not.toHaveBeenCalled();
  }

  // Secret watcher refreshes run asynchronously; reconcile is the last step of every refresh,
  // so once it ran for the function, the routing decision for it was already made.
  async function waitForRefreshOf(fnId: string) {
    const start = Date.now();
    while (!reconcileContext.mock.calls.some(([target]) => target.id == fnId)) {
      if (Date.now() - start > 10_000) {
        throw new Error(`Function ${fnId} was not refreshed in time`);
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  function resetSpies() {
    subscribe.mockClear();
    unsubscribe.mockClear();
    reconcileContext.mockClear();
  }

  beforeEach(async () => {
    process.env.FUNCTION_GRPC_ADDRESS = "0.0.0.0:38659";
    functionsPath = fs.mkdtempSync(path.join(os.tmpdir(), "spica-fn-secret-placeholder-"));

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
          path: functionsPath,
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
    scheduler = module.get(Scheduler);
    app = module.createNestApplication();
    await app.listen(request.socket);

    const rabbitmq = Array.from(scheduler.enqueuers).find(e => e.description.name == "rabbitmq");
    subscribe = jest.spyOn(rabbitmq, "subscribe").mockImplementation(() => undefined);
    unsubscribe = jest.spyOn(rabbitmq, "unsubscribe").mockImplementation(() => undefined);
    reconcileContext = jest.spyOn(scheduler, "reconcileContext");
  });

  afterEach(async () => {
    await app.close().catch(console.error);
    fs.rmSync(functionsPath, {recursive: true, force: true});
  });

  afterAll(() => fs.rmSync(assetsPath, {recursive: true, force: true}));

  describe("function schema updates", () => {
    let fnId: string;

    beforeEach(async () => {
      const userId = await insertSecret("RABBITMQ_USER", "guest");
      const passwordId = await insertSecret("RABBITMQ_PASSWORD", "s3cr3t");
      fnId = await insertFunction("amqp://localhost:5672");
      await inject(fnId, userId);
      await inject(fnId, passwordId);
      resetSpies();
    });

    it("should subscribe with resolved secrets when placeholders are added to the trigger", async () => {
      await request.put(`/function/${fnId}`, rabbitmqFunction(PLACEHOLDER_URL));

      expectResubscribed("amqp://guest:s3cr3t@localhost:5672");
    });

    it("should subscribe with resolved secrets when placeholders are updated", async () => {
      await request.put(`/function/${fnId}`, rabbitmqFunction(PLACEHOLDER_URL));
      resetSpies();

      await request.put(
        `/function/${fnId}`,
        rabbitmqFunction("amqp://${SECRET.RABBITMQ_USER}:${SECRET.RABBITMQ_PASSWORD}@broker:5672")
      );

      expectResubscribed("amqp://guest:s3cr3t@broker:5672");
    });

    it("should subscribe with the given options when placeholders are removed", async () => {
      await request.put(`/function/${fnId}`, rabbitmqFunction(PLACEHOLDER_URL));
      resetSpies();

      await request.put(`/function/${fnId}`, rabbitmqFunction("amqp://user:pass@localhost:5672"));

      expectResubscribed("amqp://user:pass@localhost:5672");
    });

    it("should keep the placeholder of a secret that is not attached", async () => {
      await request.put(
        `/function/${fnId}`,
        rabbitmqFunction("amqp://${SECRET.RABBITMQ_USER}:${SECRET.MISSING}@localhost:5672")
      );

      expectResubscribed("amqp://guest:${SECRET.MISSING}@localhost:5672");
    });

    it("should not re-subscribe when the trigger is not changed", async () => {
      await request.put(`/function/${fnId}`, rabbitmqFunction(PLACEHOLDER_URL));
      resetSpies();

      await request.put(
        `/function/${fnId}`,
        rabbitmqFunction(PLACEHOLDER_URL, {description: "changed"})
      );

      expectNotResubscribed();
    });

    it("should store and return the placeholders, never the secret values", async () => {
      await request.put(`/function/${fnId}`, rabbitmqFunction(PLACEHOLDER_URL));

      const {body} = await request.get(`/function/${fnId}`);

      expect(body.triggers.default.options.url).toEqual(PLACEHOLDER_URL);
    });

    it("should only unsubscribe when the function is deleted", async () => {
      await request.put(`/function/${fnId}`, rabbitmqFunction(PLACEHOLDER_URL));
      resetSpies();

      await request.delete(`/function/${fnId}`);

      expect(unsubscribe).toHaveBeenCalledTimes(1);
      expect(unsubscribe.mock.calls[0][0].id).toEqual(fnId);
      expect(subscribe).not.toHaveBeenCalled();
    });
  });

  describe("secret attachment", () => {
    let fnId: string;
    let userId: string;
    let passwordId: string;

    beforeEach(async () => {
      userId = await insertSecret("RABBITMQ_USER", "guest");
      passwordId = await insertSecret("RABBITMQ_PASSWORD", "s3cr3t");
      fnId = await insertFunction();
      resetSpies();
    });

    it("should re-subscribe with the resolved secret when a referenced secret is injected", async () => {
      await inject(fnId, userId);

      expectResubscribed("amqp://guest:${SECRET.RABBITMQ_PASSWORD}@localhost:5672");
    });

    it("should re-subscribe with all attached secrets resolved", async () => {
      await inject(fnId, userId);
      resetSpies();

      await inject(fnId, passwordId);

      expectResubscribed("amqp://guest:s3cr3t@localhost:5672");
    });

    it("should re-subscribe with the placeholder when a referenced secret is ejected", async () => {
      await inject(fnId, userId);
      await inject(fnId, passwordId);
      resetSpies();

      await eject(fnId, passwordId);

      expectResubscribed("amqp://guest:${SECRET.RABBITMQ_PASSWORD}@localhost:5672");
    });

    it("should not re-subscribe when a secret that is not referenced is injected or ejected", async () => {
      const unrelatedId = await insertSecret("UNRELATED", "value");

      await inject(fnId, unrelatedId);
      await eject(fnId, unrelatedId);

      expectNotResubscribed();
    });
  });

  describe("secret changes", () => {
    let fnId: string;
    let userId: string;
    let passwordId: string;

    beforeEach(async () => {
      userId = await insertSecret("RABBITMQ_USER", "guest");
      passwordId = await insertSecret("RABBITMQ_PASSWORD", "s3cr3t");
      fnId = await insertFunction();
      await inject(fnId, userId);
      await inject(fnId, passwordId);
      resetSpies();
    });

    it("should re-subscribe with the new value when a referenced secret is updated", async () => {
      await request.put(`/secret/${passwordId}`, {key: "RABBITMQ_PASSWORD", value: "rotated"});
      await waitForRefreshOf(fnId);

      expectResubscribed("amqp://guest:rotated@localhost:5672");
    });

    it("should re-subscribe with the placeholder when a referenced secret is renamed", async () => {
      await request.put(`/secret/${passwordId}`, {key: "RENAMED", value: "s3cr3t"});
      await waitForRefreshOf(fnId);

      expectResubscribed("amqp://guest:${SECRET.RABBITMQ_PASSWORD}@localhost:5672");
    });

    it("should re-subscribe with the placeholder when a referenced secret is deleted", async () => {
      await request.delete(`/secret/${passwordId}`);
      await waitForRefreshOf(fnId);

      expectResubscribed("amqp://guest:${SECRET.RABBITMQ_PASSWORD}@localhost:5672");
    });

    it("should not re-subscribe when an attached secret that is not referenced changes", async () => {
      const unrelatedId = await insertSecret("UNRELATED", "value");
      await inject(fnId, unrelatedId);
      resetSpies();

      await request.put(`/secret/${unrelatedId}`, {key: "UNRELATED", value: "changed"});
      await waitForRefreshOf(fnId);

      expectNotResubscribed();
    });
  });
});
