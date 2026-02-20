import {Test} from "@nestjs/testing";
import {FunctionModule} from "@spica-server/function";
import os from "os";
import {INestApplication} from "@nestjs/common";
import {CoreTestingModule, Request} from "@spica-server/core/testing";
import {DatabaseTestingModule} from "@spica-server/database/testing";
import {SchemaModule} from "@spica-server/core/schema";
import {OBJECTID_STRING, OBJECT_ID} from "@spica-server/core/schema/formats";
import {PassportTestingModule} from "@spica-server/passport/testing";
import {PreferenceTestingModule} from "@spica-server/preference/testing";

/**
 * Tests for HTTP trigger schema validation on create (POST), read (GET), and update (PUT) operations.
 *
 * Schema constraints under test (http.json):
 *  - required: ["path", "method"]
 *  - method enum: ["All", "Get", "Post", "Put", "Delete", "Patch", "Head"]
 *  - authenticate items enum: ["IDENTITY", "APIKEY", "USER"]
 *  - allOf conditional: authorize:true requires authenticate.minItems=1
 *  - additionalProperties: false
 */
describe("Function HTTP Trigger Schema", () => {
  let app: INestApplication;
  let request: Request;

  const baseFunction = {
    name: "http-trigger-fn",
    description: "HTTP trigger test function",
    language: "javascript",
    timeout: 10,
    triggers: {
      default: {
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
    process.env.FUNCTION_GRPC_ADDRESS = "0.0.0.0:38655";

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

  afterEach(async () => await app.close().catch(console.error));

  // ─── CREATE ────────────────────────────────────────────────────────────────

  describe("create (POST /function)", () => {
    describe("valid payloads", () => {
      it("should create a function with a minimal valid HTTP trigger (method + path only)", async () => {
        const res = await request.post("/function", {
          ...baseFunction,
          name: "minimal-http",
          triggers: {
            default: {
              options: {method: "Get", path: "/minimal"},
              type: "http",
              active: true
            }
          }
        });

        expect(res.statusCode).toEqual(201);
        expect(res.body.triggers.default.options.method).toEqual("Get");
        expect(res.body.triggers.default.options.path).toEqual("/minimal");
      });

      it.each(["All", "Get", "Post", "Put", "Delete", "Patch", "Head"])(
        "should accept method '%s'",
        async method => {
          const res = await request.post("/function", {
            ...baseFunction,
            name: `method-${method.toLowerCase()}`,
            triggers: {
              default: {
                options: {method, path: "/test"},
                type: "http",
                active: true
              }
            }
          });

          expect(res.statusCode).toEqual(201);
          expect(res.body.triggers.default.options.method).toEqual(method);
        }
      );

      it("should create with preflight enabled", async () => {
        const res = await request.post("/function", {
          ...baseFunction,
          name: "with-preflight",
          triggers: {
            default: {
              options: {method: "Post", path: "/preflight", preflight: true},
              type: "http",
              active: true
            }
          }
        });

        expect(res.statusCode).toEqual(201);
        expect(res.body.triggers.default.options.preflight).toBe(true);
      });

      it("should create with authenticate strategies", async () => {
        const res = await request.post("/function", {
          ...baseFunction,
          name: "with-auth-strategies",
          triggers: {
            default: {
              options: {
                method: "Get",
                path: "/auth",
                authenticate: ["IDENTITY", "APIKEY"]
              },
              type: "http",
              active: true
            }
          }
        });

        expect(res.statusCode).toEqual(201);
        expect(res.body.triggers.default.options.authenticate).toEqual(
          expect.arrayContaining(["IDENTITY", "APIKEY"])
        );
      });

      it("should create with all valid authenticate strategies", async () => {
        const res = await request.post("/function", {
          ...baseFunction,
          name: "all-strategies",
          triggers: {
            default: {
              options: {
                method: "Post",
                path: "/all-auth",
                authenticate: ["IDENTITY", "APIKEY", "USER"],
                authorize: true
              },
              type: "http",
              active: true
            }
          }
        });

        expect(res.statusCode).toEqual(201);
        expect(res.body.triggers.default.options.authenticate).toEqual(
          expect.arrayContaining(["IDENTITY", "APIKEY", "USER"])
        );
      });
    });

    describe("default value behavior", () => {
      it("should apply default 'Get' when method is omitted", async () => {
        const res = await request.post("/function", {
          ...baseFunction,
          name: "missing-method",
          triggers: {
            default: {
              options: {path: "/test"},
              type: "http",
              active: true
            }
          }
        });

        expect(res.statusCode).toEqual(201);
        expect(res.body.triggers.default.options.method).toEqual("Get");
      });

      it("should apply default '/' when path is omitted", async () => {
        const res = await request.post("/function", {
          ...baseFunction,
          name: "missing-path",
          triggers: {
            default: {
              options: {method: "Get"},
              type: "http",
              active: true
            }
          }
        });

        expect(res.statusCode).toEqual(201);
        expect(res.body.triggers.default.options.path).toEqual("/");
      });
    });

    describe("invalid payloads", () => {
      it("should reject when 'method' is not in the allowed enum", async () => {
        const res = await request.post("/function", {
          ...baseFunction,
          name: "invalid-method",
          triggers: {
            default: {
              options: {method: "INVALID_METHOD", path: "/test"},
              type: "http",
              active: true
            }
          }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.message).toContain("method");
      });

      it("should reject additional properties in trigger options", async () => {
        const res = await request.post("/function", {
          ...baseFunction,
          name: "extra-prop",
          triggers: {
            default: {
              options: {method: "Get", path: "/test", unknownField: true},
              type: "http",
              active: true
            }
          }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.message).toContain("must NOT have additional properties");
      });

      it("should reject authorize:true with an empty authenticate array (allOf conditional)", async () => {
        const res = await request.post("/function", {
          ...baseFunction,
          name: "authorize-no-strategy",
          triggers: {
            default: {
              options: {
                method: "Get",
                path: "/test",
                authorize: true,
                authenticate: []
              },
              type: "http",
              active: true
            }
          }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.message).toContain("authenticate");
      });

      it("should reject authorize:true when authenticate is omitted", async () => {
        const res = await request.post("/function", {
          ...baseFunction,
          name: "authorize-missing-auth",
          triggers: {
            default: {
              options: {
                method: "Get",
                path: "/test",
                authorize: true
              },
              type: "http",
              active: true
            }
          }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.message).toContain("authenticate");
      });

      it("should reject an invalid authenticate strategy value", async () => {
        const res = await request.post("/function", {
          ...baseFunction,
          name: "invalid-strategy",
          triggers: {
            default: {
              options: {
                method: "Get",
                path: "/test",
                authenticate: ["INVALID_STRATEGY"]
              },
              type: "http",
              active: true
            }
          }
        });

        expect(res.statusCode).toEqual(400);
        expect(res.body.message).toContain("authenticate");
      });
    });
  });

  // ─── READ ──────────────────────────────────────────────────────────────────

  describe("read (GET /function/:id)", () => {
    it("should return the persisted HTTP trigger options", async () => {
      const triggerOptions = {
        method: "Post",
        path: "/items",
        preflight: true,
        authenticate: ["IDENTITY"],
        authorize: true
      };

      const created = await request
        .post("/function", {
          ...baseFunction,
          name: "read-trigger-fn",
          triggers: {
            default: {options: triggerOptions, type: "http", active: true}
          }
        })
        .then(r => r.body);

      const found = await request.get(`/function/${created._id}`).then(r => r.body);

      expect(found.triggers.default.type).toEqual("http");
      expect(found.triggers.default.options.method).toEqual("Post");
      expect(found.triggers.default.options.path).toEqual("/items");
      expect(found.triggers.default.options.preflight).toBe(true);
      expect(found.triggers.default.options.authenticate).toContain("IDENTITY");
      expect(found.triggers.default.options.authorize).toBe(true);
    });

    it("should persist default values omitted on creation", async () => {
      const created = await request
        .post("/function", {
          ...baseFunction,
          name: "default-values-fn",
          triggers: {
            default: {
              options: {method: "Get", path: "/defaults"},
              type: "http",
              active: true
            }
          }
        })
        .then(r => r.body);

      const found = await request.get(`/function/${created._id}`).then(r => r.body);
      const opts = found.triggers.default.options;

      // Schema defaults: preflight=true, authorize=false, authenticate=[]
      expect(typeof opts.preflight).toBe("boolean");
      expect(opts.authenticate).toEqual([]);
    });

    it("should return 404 for a non-existent function id", async () => {
      const res = await request.get("/function/000000000000000000000000");

      expect(res.statusCode).toEqual(404);
    });
  });

  // ─── UPDATE ────────────────────────────────────────────────────────────────

  describe("update (PUT /function/:id)", () => {
    describe("valid updates", () => {
      it("should replace HTTP trigger options with a new valid method", async () => {
        const created = await request
          .post("/function", {
            ...baseFunction,
            name: "update-method-fn"
          })
          .then(r => r.body);

        const updated = await request.put(`/function/${created._id}`, {
          ...created,
          triggers: {
            default: {
              options: {method: "Delete", path: "/test"},
              type: "http",
              active: true
            }
          }
        });

        expect(updated.statusCode).toEqual(200);
        expect(updated.body.triggers.default.options.method).toEqual("Delete");
      });

      it("should update path in HTTP trigger options", async () => {
        const created = await request
          .post("/function", {
            ...baseFunction,
            name: "update-path-fn"
          })
          .then(r => r.body);

        const updated = await request.put(`/function/${created._id}`, {
          ...created,
          triggers: {
            default: {
              options: {method: "Get", path: "/new-path"},
              type: "http",
              active: true
            }
          }
        });

        expect(updated.statusCode).toEqual(200);
        expect(updated.body.triggers.default.options.path).toEqual("/new-path");
      });

      it("should enable authorization by adding a strategy and setting authorize:true", async () => {
        const created = await request
          .post("/function", {
            ...baseFunction,
            name: "enable-auth-fn",
            triggers: {
              default: {
                options: {method: "Get", path: "/auth", authorize: false, authenticate: []},
                type: "http",
                active: true
              }
            }
          })
          .then(r => r.body);

        const updated = await request.put(`/function/${created._id}`, {
          ...created,
          triggers: {
            default: {
              options: {
                method: "Get",
                path: "/auth",
                authorize: true,
                authenticate: ["APIKEY"]
              },
              type: "http",
              active: true
            }
          }
        });

        expect(updated.statusCode).toEqual(200);
        expect(updated.body.triggers.default.options.authorize).toBe(true);
        expect(updated.body.triggers.default.options.authenticate).toContain("APIKEY");
      });

      it("should disable preflight in an existing function", async () => {
        const created = await request
          .post("/function", {
            ...baseFunction,
            name: "disable-preflight-fn",
            triggers: {
              default: {
                options: {method: "Get", path: "/cors", preflight: true},
                type: "http",
                active: true
              }
            }
          })
          .then(r => r.body);

        const updated = await request.put(`/function/${created._id}`, {
          ...created,
          triggers: {
            default: {
              options: {method: "Get", path: "/cors", preflight: false},
              type: "http",
              active: true
            }
          }
        });

        expect(updated.statusCode).toEqual(200);
        expect(updated.body.triggers.default.options.preflight).toBe(false);
      });

      it("should ignore language change on PUT (language is immutable)", async () => {
        const created = await request
          .post("/function", {
            ...baseFunction,
            name: "immutable-lang-fn"
          })
          .then(r => r.body);

        const updated = await request.put(`/function/${created._id}`, {
          ...created,
          language: "typescript"
        });

        expect(updated.statusCode).toEqual(200);

        // PUT response strips language (CRUD.replace deletes it), so verify via GET
        const found = await request.get(`/function/${created._id}`).then(r => r.body);
        expect(found.language).toEqual(created.language);
      });
    });

    describe("invalid updates", () => {
      it("should reject updating with an invalid method on PUT", async () => {
        const created = await request
          .post("/function", {
            ...baseFunction,
            name: "reject-invalid-method-fn"
          })
          .then(r => r.body);

        const updated = await request.put(`/function/${created._id}`, {
          ...created,
          triggers: {
            default: {
              options: {method: "OPTIONS", path: "/test"},
              type: "http",
              active: true
            }
          }
        });

        expect(updated.statusCode).toEqual(400);
        expect(updated.body.message).toContain("method");
      });

      it("should apply default '/' when path is omitted on PUT", async () => {
        const created = await request
          .post("/function", {
            ...baseFunction,
            name: "no-path-update-fn"
          })
          .then(r => r.body);

        const updated = await request.put(`/function/${created._id}`, {
          ...created,
          triggers: {
            default: {
              options: {method: "Get"},
              type: "http",
              active: true
            }
          }
        });

        // Schema default "/" is applied when path is omitted
        expect(updated.statusCode).toEqual(200);
        expect(updated.body.triggers.default.options.path).toEqual("/");
      });

      it("should reject authorize:true with empty authenticate on PUT (allOf conditional)", async () => {
        const created = await request
          .post("/function", {
            ...baseFunction,
            name: "reject-auth-conditional-fn"
          })
          .then(r => r.body);

        const updated = await request.put(`/function/${created._id}`, {
          ...created,
          triggers: {
            default: {
              options: {
                method: "Get",
                path: "/test",
                authorize: true,
                authenticate: []
              },
              type: "http",
              active: true
            }
          }
        });

        expect(updated.statusCode).toEqual(400);
        expect(updated.body.message).toContain("authenticate");
      });

      it("should reject authorize:true when authenticate is omitted on PUT", async () => {
        const created = await request
          .post("/function", {
            ...baseFunction,
            name: "reject-auth-missing-fn"
          })
          .then(r => r.body);

        const updated = await request.put(`/function/${created._id}`, {
          ...created,
          triggers: {
            default: {
              options: {
                method: "Get",
                path: "/test",
                authorize: true
              },
              type: "http",
              active: true
            }
          }
        });

        expect(updated.statusCode).toEqual(400);
        expect(updated.body.message).toContain("authenticate");
      });

      it("should reject additional properties in trigger options on PUT", async () => {
        const created = await request
          .post("/function", {
            ...baseFunction,
            name: "reject-extra-prop-fn"
          })
          .then(r => r.body);

        const updated = await request.put(`/function/${created._id}`, {
          ...created,
          triggers: {
            default: {
              options: {method: "Get", path: "/test", notAllowed: 123},
              type: "http",
              active: true
            }
          }
        });

        expect(updated.statusCode).toEqual(400);
        expect(updated.body.message).toContain("must NOT have additional properties");
      });

      it("should reject an invalid authenticate strategy value on PUT", async () => {
        const created = await request
          .post("/function", {
            ...baseFunction,
            name: "reject-invalid-strategy-fn"
          })
          .then(r => r.body);

        const updated = await request.put(`/function/${created._id}`, {
          ...created,
          triggers: {
            default: {
              options: {
                method: "Get",
                path: "/test",
                authenticate: ["OAUTH2"]
              },
              type: "http",
              active: true
            }
          }
        });

        expect(updated.statusCode).toEqual(400);
        expect(updated.body.message).toContain("authenticate");
      });
    });
  });
});
