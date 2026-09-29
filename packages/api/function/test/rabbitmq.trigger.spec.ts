import {Test} from "@nestjs/testing";
import {FunctionModule} from "@spica-server/function";
import os from "os";
import fs from "fs";
import path from "path";
import {INestApplication} from "@nestjs/common";
import {CoreTestingModule, Request} from "@spica-server/core-testing";
import {DatabaseTestingModule} from "@spica-server/database-testing";
import {SchemaModule} from "@spica-server/core-schema";
import {OBJECTID_STRING, OBJECT_ID} from "@spica-server/core-schema";
import {PassportTestingModule} from "@spica-server/passport-testing";
import {PreferenceTestingModule} from "@spica-server/preference-testing";
import {SecretModule} from "@spica-server/secret";

describe("Function RabbitMQ Trigger Schema", () => {
  let app: INestApplication;
  let request: Request;

  const assetsPath = fs.mkdtempSync(path.join(os.tmpdir(), "spica-fn-assets-"));

  function rabbitmqFunction(name: string, options: Record<string, unknown>) {
    return {
      name,
      description: "RabbitMQ trigger test function",
      language: "javascript",
      timeout: 10,
      triggers: {
        default: {
          type: "rabbitmq",
          active: false,
          options: {url: "amqp://localhost:5672", ...options}
        }
      }
    };
  }

  beforeEach(async () => {
    process.env.FUNCTION_GRPC_ADDRESS = "0.0.0.0:38657";

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
    await app.listen(request.socket);
  });

  afterEach(async () => await app.close().catch(console.error));

  afterAll(() => fs.rmSync(assetsPath, {recursive: true, force: true}));

  describe("defaults", () => {
    it("should only require the url and keep the defaults of the existing options", async () => {
      const res = await request.post("/function", rabbitmqFunction("defaults", {}));

      expect(res.statusCode).toEqual(201);
      expect(res.body.triggers.default.options).toEqual({
        url: "amqp://localhost:5672",
        queue: {name: "", durable: false},
        noAck: true
      });
    });

    it("should default the durability and the pattern of an exchange", async () => {
      const res = await request.post(
        "/function",
        rabbitmqFunction("exchange-defaults", {exchange: {name: "events", type: "topic"}})
      );

      expect(res.statusCode).toEqual(201);
      expect(res.body.triggers.default.options.exchange).toEqual({
        name: "events",
        type: "topic",
        durable: false,
        pattern: ""
      });
    });
  });

  describe("valid payloads", () => {
    it("should accept every option", async () => {
      const options = {
        url: "amqps://broker.example.com:5671/vhost?heartbeat=30",
        socketOptions: {
          ca: ["-----BEGIN CERTIFICATE-----"],
          cert: "cert",
          key: "key",
          passphrase: "secret",
          servername: "broker.example.com",
          rejectUnauthorized: false,
          timeout: 5000,
          clientProperties: {connection_name: "spica"},
          noDelay: true
        },
        exchange: {
          name: "events",
          type: "x-delayed-message",
          durable: true,
          internal: false,
          autoDelete: false,
          alternateExchange: "unrouted",
          arguments: {"x-delayed-type": "direct"},
          passive: false,
          pattern: ["info", "error"],
          headers: {"x-match": "all", format: "json", version: 2, urgent: true}
        },
        bindings: [{exchange: "audit", pattern: "#", arguments: {source: "spica"}}],
        exchangeBindings: [{source: "audit", destination: "events", pattern: "#"}],
        queue: {
          name: "jobs",
          durable: true,
          exclusive: false,
          autoDelete: false,
          messageTtl: 60000,
          expires: 3600000,
          deadLetterExchange: "dead",
          deadLetterRoutingKey: "jobs.dead",
          maxLength: 1000,
          maxPriority: 10,
          arguments: {"x-queue-type": "quorum", "x-delivery-limit": 5},
          passive: false
        },
        prefetch: 10,
        prefetchGlobal: true,
        consume: {
          consumerTag: "spica",
          exclusive: false,
          priority: 1,
          noLocal: false,
          arguments: {"x-stream-offset": "first"}
        },
        noAck: false
      };

      const res = await request.post("/function", rabbitmqFunction("all-options", options));

      expect(res.statusCode).toEqual(201);
      expect(res.body.triggers.default.options).toEqual(options);
    });

    it("should accept a single pattern as a string", async () => {
      const res = await request.post(
        "/function",
        rabbitmqFunction("string-pattern", {
          bindings: [{exchange: "audit", pattern: "audit.*"}]
        })
      );

      expect(res.statusCode).toEqual(201);
    });

    it("should update the trigger options", async () => {
      const {body: created} = await request.post("/function", rabbitmqFunction("updated", {}));

      const res = await request.put(`/function/${created._id}`, {
        ...created,
        triggers: {
          default: {
            ...created.triggers.default,
            options: {
              ...created.triggers.default.options,
              queue: {name: "jobs", durable: true, arguments: {"x-queue-type": "quorum"}},
              noAck: false
            }
          }
        }
      });

      expect(res.statusCode).toEqual(200);
      expect(res.body.triggers.default.options.queue.arguments).toEqual({
        "x-queue-type": "quorum"
      });
    });
  });

  describe("invalid payloads", () => {
    it("should reject a missing url", async () => {
      const res = await request.post("/function", {
        ...rabbitmqFunction("missing-url", {}),
        triggers: {default: {type: "rabbitmq", active: false, options: {}}}
      });

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toContain("url");
    });

    function slug(text: string) {
      return text.replace(/\s+/g, "-");
    }

    it.each([
      [
        "top level",
        {unknown: true},
        ".triggers.default.options must NOT have additional properties"
      ],
      [
        "exchange",
        {exchange: {name: "events", type: "topic", unknown: true}},
        ".triggers.default.options.exchange must NOT have additional properties"
      ],
      [
        "queue",
        {queue: {name: "jobs", unknown: true}},
        ".triggers.default.options.queue must NOT have additional properties"
      ],
      [
        "consume",
        {consume: {unknown: true}},
        ".triggers.default.options.consume must NOT have additional properties"
      ],
      [
        "binding",
        {bindings: [{exchange: "audit", unknown: true}]},
        ".triggers.default.options.bindings.0 must NOT have additional properties"
      ],
      [
        "exchange binding",
        {exchangeBindings: [{source: "a", destination: "b", unknown: true}]},
        ".triggers.default.options.exchangeBindings.0 must NOT have additional properties"
      ]
    ])("should reject an unknown property on the %s", async (place, options, message) => {
      const res = await request.post(
        "/function",
        rabbitmqFunction(`unknown-${slug(place)}`, options)
      );

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toBe(message);
    });

    it.each([
      ["prefetch", {prefetch: "many"}, ".triggers.default.options.prefetch must be integer"],
      ["negative prefetch", {prefetch: -1}, ".triggers.default.options.prefetch must be >= 0"],
      [
        "queue arguments",
        {queue: {name: "jobs", arguments: "quorum"}},
        ".triggers.default.options.queue.arguments must be object"
      ],
      [
        "exchange without a type",
        {exchange: {name: "events"}},
        ".triggers.default.options.exchange must have required property 'type'"
      ],
      [
        "binding without an exchange",
        {bindings: [{pattern: "#"}]},
        ".triggers.default.options.bindings.0 must have required property 'exchange'"
      ],
      [
        "exchange binding without a source",
        {exchangeBindings: [{destination: "b"}]},
        ".triggers.default.options.exchangeBindings.0 must have required property 'source'"
      ],
      [
        "pattern with numbers",
        {exchange: {name: "e", type: "topic", pattern: [1]}},
        ".triggers.default.options.exchange.pattern.0 must be string"
      ],
      ["noAck", {noAck: "no"}, ".triggers.default.options.noAck must be boolean"]
    ])("should reject an invalid %s", async (place, options, message) => {
      const res = await request.post(
        "/function",
        rabbitmqFunction(`invalid-${slug(place)}`, options)
      );

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toBe(message);
    });
  });
});
