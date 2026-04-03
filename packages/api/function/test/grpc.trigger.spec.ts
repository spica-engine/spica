import {Test} from "@nestjs/testing";
import {FunctionModule} from "@spica-server/function";
import os from "os";
import {INestApplication} from "@nestjs/common";
import {CoreTestingModule, Request} from "@spica-server/core-testing";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {SchemaModule} from "@spica-server/core-schema";
import {OBJECTID_STRING, OBJECT_ID} from "@spica-server/core-schema";
import {PassportTestingModule} from "@spica-server/passport-testing";
import {PreferenceTestingModule} from "@spica-server/preference-testing";
import {SecretModule} from "@spica-server/secret/src/module";

describe("Function gRPC Trigger Schema", () => {
  let app: INestApplication;
  let request: Request;

  const baseFunction = {
    name: "grpc-trigger-fn",
    description: "gRPC trigger test function",
    language: "javascript",
    timeout: 10,
    triggers: {
      default: {
        options: {
          requestParams: [{name: "message", type: "string"}],
          responseParams: [{name: "reply", type: "string"}]
        },
        type: "grpc",
        active: true
      }
    }
  };

  beforeEach(async () => {
    process.env.FUNCTION_GRPC_ADDRESS = "0.0.0.0:38656";

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

  afterEach(async () => await app.close().catch(console.error));

  describe("create (POST /function)", () => {
    describe("valid payloads", () => {
      it("should create a function with valid gRPC trigger", async () => {
        const res = await request.post("/function", baseFunction);

        expect(res.statusCode).toEqual(201);
        expect(res.body.triggers.default.type).toEqual("grpc");
        expect(res.body.triggers.default.options.requestParams).toEqual([
          {name: "message", type: "string"}
        ]);
        expect(res.body.triggers.default.options.responseParams).toEqual([
          {name: "reply", type: "string"}
        ]);
      });

      it.each(["string", "int32", "int64", "float", "double", "bool", "bytes"])(
        "should accept param type '%s'",
        async type => {
          const res = await request.post("/function", {
            ...baseFunction,
            name: `type-${type}`,
            triggers: {
              default: {
                options: {
                  requestParams: [{name: "field", type}],
                  responseParams: [{name: "field", type}]
                },
                type: "grpc",
                active: true
              }
            }
          });

          expect(res.statusCode).toEqual(201);
        }
      );

      it("should create with multiple request and response params", async () => {
        const res = await request.post("/function", {
          ...baseFunction,
          name: "multi-params",
          triggers: {
            default: {
              options: {
                requestParams: [
                  {name: "name", type: "string"},
                  {name: "age", type: "int32"},
                  {name: "active", type: "bool"}
                ],
                responseParams: [
                  {name: "greeting", type: "string"},
                  {name: "score", type: "double"}
                ]
              },
              type: "grpc",
              active: true
            }
          }
        });

        expect(res.statusCode).toEqual(201);
        expect(res.body.triggers.default.options.requestParams).toHaveLength(3);
        expect(res.body.triggers.default.options.responseParams).toHaveLength(2);
      });
    });

    describe("invalid payloads", () => {
      it("should reject when requestParams is missing", async () => {
        const res = await request.post("/function", {
          ...baseFunction,
          name: "missing-request",
          triggers: {
            default: {
              options: {
                responseParams: [{name: "reply", type: "string"}]
              },
              type: "grpc",
              active: true
            }
          }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.message).toContain("requestParams");
      });

      it("should reject when responseParams is missing", async () => {
        const res = await request.post("/function", {
          ...baseFunction,
          name: "missing-response",
          triggers: {
            default: {
              options: {
                requestParams: [{name: "msg", type: "string"}]
              },
              type: "grpc",
              active: true
            }
          }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.message).toContain("responseParams");
      });

      it("should reject invalid param type", async () => {
        const res = await request.post("/function", {
          ...baseFunction,
          name: "invalid-type",
          triggers: {
            default: {
              options: {
                requestParams: [{name: "field", type: "invalid_type"}],
                responseParams: [{name: "field", type: "string"}]
              },
              type: "grpc",
              active: true
            }
          }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.message).toContain("type");
      });

      it("should reject param without name", async () => {
        const res = await request.post("/function", {
          ...baseFunction,
          name: "missing-name",
          triggers: {
            default: {
              options: {
                requestParams: [{type: "string"}],
                responseParams: [{name: "reply", type: "string"}]
              },
              type: "grpc",
              active: true
            }
          }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.message).toContain("name");
      });

      it("should reject param with empty name", async () => {
        const res = await request.post("/function", {
          ...baseFunction,
          name: "empty-name",
          triggers: {
            default: {
              options: {
                requestParams: [{name: "", type: "string"}],
                responseParams: [{name: "reply", type: "string"}]
              },
              type: "grpc",
              active: true
            }
          }
        });

        expect(res.statusCode).toEqual(400);
      });

      it("should reject additional properties in trigger options", async () => {
        const res = await request.post("/function", {
          ...baseFunction,
          name: "extra-prop",
          triggers: {
            default: {
              options: {
                requestParams: [{name: "msg", type: "string"}],
                responseParams: [{name: "reply", type: "string"}],
                unknownField: true
              },
              type: "grpc",
              active: true
            }
          }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.message).toContain("must NOT have additional properties");
      });

      it("should reject additional properties in param objects", async () => {
        const res = await request.post("/function", {
          ...baseFunction,
          name: "extra-param-prop",
          triggers: {
            default: {
              options: {
                requestParams: [{name: "msg", type: "string", extraField: "bad"}],
                responseParams: [{name: "reply", type: "string"}]
              },
              type: "grpc",
              active: true
            }
          }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.message).toContain("must NOT have additional properties");
      });
    });
  });
});
