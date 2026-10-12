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

describe("Function RabbitMQ Stream Trigger Schema", () => {
  let app: INestApplication;
  let request: Request;

  const assetsPath = fs.mkdtempSync(path.join(os.tmpdir(), "spica-fn-assets-"));

  const connection = {hostname: "rabbitmq", username: "guest", password: "guest"};
  const stream = {name: "orders"};

  function streamFunction(name: string, options: Record<string, unknown>) {
    return {
      name,
      description: "RabbitMQ stream trigger test function",
      language: "javascript",
      timeout: 10,
      triggers: {
        default: {
          type: "rabbitmq",
          active: false,
          options: {mode: "stream", connection, stream, ...options}
        }
      }
    };
  }

  beforeEach(async () => {
    process.env.FUNCTION_GRPC_ADDRESS = "0.0.0.0:38658";

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

  async function create(name: string, options: Record<string, unknown>) {
    return request.post("/function", streamFunction(name, options));
  }

  describe("defaults", () => {
    it("should default the port, the vhost and the starting offset", async () => {
      const res = await create("defaults", {});

      expect(res.statusCode).toEqual(201);
      expect(res.body.triggers.default.options).toEqual({
        mode: "stream",
        connection: {...connection, port: 5552, vhost: "/"},
        stream,
        consumer: {offset: {type: "next"}}
      });
    });

    it("should keep the given consumer options", async () => {
      const consumer = {
        offset: {type: "offset", value: 10},
        consumerRef: "projector",
        singleActive: true,
        filter: {values: ["eu"], matchUnfiltered: false},
        creditPolicy: {type: "onChunkReceived", startFrom: 2, step: 2}
      };
      const res = await create("consumer", {consumer});

      expect(res.statusCode).toEqual(201);
      expect(res.body.triggers.default.options.consumer).toEqual(consumer);
    });
  });

  describe("valid payloads", () => {
    it("should accept every connection and stream option", async () => {
      const res = await create("full", {
        connection: {
          ...connection,
          port: 5551,
          vhost: "orders",
          mechanism: "PLAIN",
          frameMax: 1048576,
          heartbeat: 60,
          socketTimeout: 5000,
          connectionName: "spica-orders",
          ssl: {key: "k", cert: "c", ca: "a", rejectUnauthorized: false},
          addressResolver: {enabled: true, endpoint: {host: "lb.internal", port: 5552}},
          bufferSizeSettings: {initialSize: 1024, maxRatio: 0.5, multiplier: 2}
        },
        stream: {
          name: "orders",
          passive: false,
          arguments: {
            "max-age": "7D",
            "max-length-bytes": 10000000000,
            "stream-max-segment-size-bytes": 500000000,
            "initial-cluster-size": 3,
            "queue-leader-locator": "least-leaders",
            "x-custom": "value"
          }
        }
      });

      expect(res.statusCode).toEqual(201);
    });

    it.each([
      ["ssl as a boolean", {ssl: true}],
      ["a disabled address resolver", {addressResolver: {enabled: false}}],
      ["an address resolver without an endpoint", {addressResolver: {enabled: true}}]
    ])("should accept %s", async (name, extra) => {
      const res = await create(name.replace(/\s+/g, "-"), {connection: {...connection, ...extra}});

      expect(res.statusCode).toEqual(201);
    });

    it.each([
      ["first", {type: "first"}],
      ["last", {type: "last"}],
      ["next", {type: "next"}],
      ["an offset", {type: "offset", value: 0}],
      ["a timestamp in ISO format", {type: "timestamp", value: "2026-01-01T00:00:00.000Z"}],
      ["a timestamp in epoch milliseconds", {type: "timestamp", value: 1767225600000}]
    ])("should accept %s as the starting offset", async (name, offset) => {
      const res = await create(name.replace(/\s+/g, "-"), {consumer: {offset}});

      expect(res.statusCode).toEqual(201);
    });

    it("should update the trigger options", async () => {
      const created = await create("update", {});
      const fn = created.body;
      fn.triggers.default.options.consumer = {offset: {type: "first"}, consumerRef: "ref"};

      const res = await request.put(`/function/${fn._id}`, fn);

      expect(res.statusCode).toEqual(200);
      expect(res.body.triggers.default.options.consumer).toEqual({
        offset: {type: "first"},
        consumerRef: "ref"
      });
    });
  });

  describe("invalid payloads", () => {
    it.each([
      [
        "connection",
        {connection: undefined},
        ".triggers.default.options must have required property 'connection'"
      ],
      [
        "stream",
        {stream: undefined},
        ".triggers.default.options must have required property 'stream'"
      ],
      [
        "hostname",
        {connection: {username: "guest", password: "guest"}},
        ".triggers.default.options.connection must have required property 'hostname'"
      ],
      [
        "username",
        {connection: {hostname: "rabbitmq", password: "guest"}},
        ".triggers.default.options.connection must have required property 'username'"
      ],
      [
        "password",
        {connection: {hostname: "rabbitmq", username: "guest"}},
        ".triggers.default.options.connection must have required property 'password'"
      ],
      [
        "stream name",
        {stream: {}},
        ".triggers.default.options.stream must have required property 'name'"
      ]
    ])("should reject a missing %s", async (name, options, message) => {
      const res = await create(`missing-${name.replace(/\s+/g, "-")}`, options);

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toEqual(message);
    });

    it.each([
      ["noAck", {noAck: true}, ".triggers.default.options.noAck boolean schema is false"],
      ["queue", {queue: {name: "q"}}, ".triggers.default.options.queue boolean schema is false"],
      [
        "url",
        {url: "amqp://localhost:5672"},
        ".triggers.default.options.url boolean schema is false"
      ]
    ])("should reject the queue option %s in the stream mode", async (name, options, message) => {
      const res = await create(`queue-key-${name}`, options);

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toEqual(message);
    });

    it.each([
      ["connection", {connection}, ".triggers.default.options.connection boolean schema is false"],
      ["stream", {stream}, ".triggers.default.options.stream boolean schema is false"],
      [
        "consumer",
        {consumer: {offset: {type: "first"}}},
        ".triggers.default.options.consumer boolean schema is false"
      ]
    ])("should reject the stream option %s in the queue mode", async (name, extra, message) => {
      const res = await request.post("/function", {
        ...streamFunction(`stream-key-${name}`, {}),
        triggers: {
          default: {
            type: "rabbitmq",
            active: false,
            options: {url: "amqp://localhost:5672", ...extra}
          }
        }
      });

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toEqual(message);
    });

    it.each([
      [
        "top level",
        {unknown: true},
        ".triggers.default.options must NOT have additional properties"
      ],
      [
        "connection",
        {connection: {...connection, unknown: true}},
        ".triggers.default.options.connection must NOT have additional properties"
      ],
      [
        "ssl",
        {connection: {...connection, ssl: {unknown: true}}},
        ".triggers.default.options.connection.ssl must NOT have additional properties"
      ],
      [
        "stream",
        {stream: {...stream, unknown: true}},
        ".triggers.default.options.stream must NOT have additional properties"
      ],
      [
        "consumer",
        {consumer: {unknown: true}},
        ".triggers.default.options.consumer must NOT have additional properties"
      ],
      [
        "offset",
        {consumer: {offset: {type: "first", unknown: true}}},
        ".triggers.default.options.consumer.offset must NOT have additional properties"
      ],
      [
        "filter",
        {consumer: {filter: {values: ["eu"], unknown: true}}},
        ".triggers.default.options.consumer.filter must NOT have additional properties"
      ],
      [
        "credit policy",
        {consumer: {creditPolicy: {type: "onChunkReceived", unknown: true}}},
        ".triggers.default.options.consumer.creditPolicy must NOT have additional properties"
      ]
    ])("should reject an unknown key in the %s", async (name, options, message) => {
      const res = await create(`unknown-${name.replace(/\s+/g, "-")}`, options);

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toEqual(message);
    });

    it("should reject singleActive without a consumerRef", async () => {
      const res = await create("single-active", {consumer: {singleActive: true}});

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toEqual(
        ".triggers.default.options.consumer must have property consumerRef when property singleActive is present"
      );
    });

    it.each([
      ["offset", {type: "offset"}],
      ["timestamp", {type: "timestamp"}]
    ])("should require a value for the %s starting offset", async (name, offset) => {
      const res = await create(`value-${name}`, {consumer: {offset}});

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toEqual(
        ".triggers.default.options.consumer.offset must have required property 'value'"
      );
    });

    it("should reject an unknown offset type", async () => {
      const res = await create("offset-type", {consumer: {offset: {type: "middle"}}});

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toEqual(
        ".triggers.default.options.consumer.offset.type must be equal to one of the allowed values"
      );
    });

    it("should reject a negative offset", async () => {
      const res = await create("offset-negative", {
        consumer: {offset: {type: "offset", value: -1}}
      });

      expect(res.statusCode).toEqual(400);
    });

    it("should reject an empty list of filter values", async () => {
      const res = await create("filter-empty", {consumer: {filter: {values: []}}});

      expect(res.statusCode).toEqual(400);
    });
  });
});
