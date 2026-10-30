import {Test} from "@nestjs/testing";
import {INestApplication} from "@nestjs/common";
import os from "os";
import fs from "fs";
import net from "net";
import path from "path";
import amqp from "amqplib";
import {GenericContainer, StartedTestContainer, Wait} from "testcontainers";
import {FunctionModule} from "@spica-server/function";
import {CoreTestingModule, Request} from "@spica-server/core-testing";
import {DatabaseTestingModule} from "@spica-server/database-testing";
import {SchemaModule, OBJECTID_STRING, OBJECT_ID} from "@spica-server/core-schema";
import {PassportTestingModule} from "@spica-server/passport-testing";
import {PreferenceTestingModule} from "@spica-server/preference-testing";
import {SecretModule} from "@spica-server/secret";

const RABBITMQ_USER = "spica";
const RABBITMQ_PASSWORD = "spica-secret-password";
const QUEUE = "secret-placeholder-e2e";

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "0.0.0.0", () => {
      const {port} = server.address() as net.AddressInfo;
      server.close(() => resolve(port));
    });
  });
}

async function waitFor<T>(probe: () => Promise<T | undefined>, timeoutMs: number): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = await probe().catch(() => undefined);
    if (value !== undefined) {
      return value;
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`Condition was not met in ${timeoutMs}ms`);
}

describe("RabbitMQ trigger with secret placeholders (e2e)", () => {
  let container: StartedTestContainer;
  let port: number;

  let app: INestApplication;
  let request: Request;

  let functionsPath: string;
  let markerPath: string;
  const assetsPath = fs.mkdtempSync(path.join(os.tmpdir(), "spica-fn-assets-"));

  const brokerUrl = () => `amqp://${RABBITMQ_USER}:${RABBITMQ_PASSWORD}@localhost:${port}`;

  beforeAll(async () => {
    container = await new GenericContainer("rabbitmq:4.1")
      .withEnvironment({
        RABBITMQ_DEFAULT_USER: RABBITMQ_USER,
        RABBITMQ_DEFAULT_PASS: RABBITMQ_PASSWORD
      })
      .withExposedPorts(5672)
      .withWaitStrategy(Wait.forLogMessage(/Server startup complete/))
      .withStartupTimeout(120_000)
      .start();
    port = container.getMappedPort(5672);
  }, 180_000);

  afterAll(async () => {
    await container?.stop();
    fs.rmSync(assetsPath, {recursive: true, force: true});
  });

  beforeEach(async () => {
    process.env.FUNCTION_GRPC_ADDRESS = `0.0.0.0:${await getFreePort()}`;
    functionsPath = fs.mkdtempSync(path.join(os.tmpdir(), "spica-fn-rabbitmq-secret-"));
    markerPath = path.join(functionsPath, "received.txt");

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
    app = module.createNestApplication();
    await app.listen(request.socket);
  }, 60_000);

  afterEach(async () => {
    await app.close().catch(console.error);
    fs.rmSync(functionsPath, {recursive: true, force: true});
  });

  it("should connect to an authenticated broker with the injected secrets and execute the function", async () => {
    const userId = await request
      .post("/secret", {key: "RABBITMQ_USER", value: RABBITMQ_USER})
      .then(res => res.body._id);
    const passwordId = await request
      .post("/secret", {key: "RABBITMQ_PASSWORD", value: RABBITMQ_PASSWORD})
      .then(res => res.body._id);

    const fn = {
      name: "secret_consumer",
      language: "javascript",
      timeout: 10,
      triggers: {
        default: {
          type: "rabbitmq",
          active: false,
          options: {
            url: `amqp://\${SECRET.RABBITMQ_USER}:\${SECRET.RABBITMQ_PASSWORD}@localhost:${port}`,
            queue: {name: QUEUE, durable: false},
            noAck: true
          }
        }
      }
    };
    const {body: inserted} = await request.post("/function", fn);

    await request.put(`/function/${inserted._id}/secret/${userId}`);
    await request.put(`/function/${inserted._id}/secret/${passwordId}`);

    await request.post(`/function/${inserted._id}/index`, {
      index: `
        import fs from "fs";
        export default function (message) {
          fs.writeFileSync(${JSON.stringify(markerPath)}, message.content.toString());
        }
      `
    });

    fn.triggers.default.active = true;
    const updated = await request.put(`/function/${inserted._id}`, fn);
    expect(updated.statusCode).toEqual(200);
    expect(updated.body.triggers.default.options.url).toContain("${SECRET.RABBITMQ_PASSWORD}");

    const connection = await amqp.connect(brokerUrl());
    try {
      const channel = await connection.createChannel();
      await channel.assertQueue(QUEUE, {durable: false});

      const consumers = await waitFor(async () => {
        const {consumerCount} = await channel.checkQueue(QUEUE);
        return consumerCount > 0 ? consumerCount : undefined;
      }, 20_000);
      expect(consumers).toEqual(1);

      channel.sendToQueue(QUEUE, Buffer.from("hello from rabbitmq"));

      const received = await waitFor(
        async () => (fs.existsSync(markerPath) ? fs.readFileSync(markerPath, "utf-8") : undefined),
        30_000
      );
      expect(received).toEqual("hello from rabbitmq");
    } finally {
      await connection.close();
    }
  }, 90_000);
});
