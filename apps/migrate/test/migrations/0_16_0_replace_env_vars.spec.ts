import {
  Db,
  getConnectionUri,
  getDatabaseName,
  ObjectId,
  start
} from "@spica-server/database/testing";
import color from "cli-color/lib/supports-color";
import {run} from "@spica/migrate";
import path from "path";

process.env.TESTONLY_MIGRATION_LOOKUP_DIR = path.join(process.cwd(), "dist/apps/migrate/src");

describe("Replace env vars", () => {
  let db: Db;
  let args: string[];

  beforeAll(() => {
    color.disableColor();
  });

  beforeEach(async () => {
    const connection = await start("replset");
    args = ["--database-uri", await getConnectionUri(), "--database-name", getDatabaseName()];
    db = connection.db(args[3]);

    await db.collection("function").insertMany([
      {
        name: "newFuncJs",
        language: "javascript",
        timeout: 6,
        triggers: {
          default: {
            type: "http",
            active: true,
            options: {
              method: "Get",
              path: "/new-func-js",
              preflight: true
            }
          }
        },
        env_vars: {
          SECRET: "123",
          APIKEY: "OBJECT_ID"
        }
      },
      {
        name: "brandNewFuncJs",
        language: "javascript",
        timeout: 6,
        triggers: {
          default: {
            type: "http",
            active: true,
            options: {
              method: "Get",
              path: "/brand-new-func-js",
              preflight: true
            }
          }
        },
        env_vars: {}
      },
      {
        name: "newFuncTs",
        language: "typescript",
        timeout: 6,
        triggers: {
          default: {
            type: "http",
            active: true,
            options: {
              method: "Get",
              path: "/new-func-ts",
              preflight: true
            }
          }
        },
        env_vars: {
          SECRET: "123"
        }
      }
    ]);
  });

  it("should insert env vars", async () => {
    await run([...args, "--from", "0.15.0", "--to", "0.16.0", "--continue-if-versions-are-equal"]);
    const envVars = await db
      .collection("env_var")
      .find({})
      .map(obj => {
        delete obj._id;
        return obj;
      })
      .toArray();

    expect(envVars).toEqual([
      {
        key: "SECRET",
        value: "123"
      },
      {
        key: "APIKEY",
        value: "OBJECT_ID"
      },
      {
        key: "SECRET",
        value: "123"
      }
    ]);
  });

  it("should replace env vars", async () => {
    await run([...args, "--from", "0.15.0", "--to", "0.16.0", "--continue-if-versions-are-equal"]);
    const functions = await db
      .collection("function")
      .find({})
      .map(obj => {
        delete obj._id;
        return obj;
      })
      .toArray();

    expect(functions).toEqual([
      {
        name: "newFuncJs",
        language: "javascript",
        timeout: 6,
        triggers: {
          default: {
            type: "http",
            active: true,
            options: {
              method: "Get",
              path: "/new-func-js",
              preflight: true
            }
          }
        },
        env_vars: functions[0].env_vars
      },
      {
        name: "brandNewFuncJs",
        language: "javascript",
        timeout: 6,
        triggers: {
          default: {
            type: "http",
            active: true,
            options: {
              method: "Get",
              path: "/brand-new-func-js",
              preflight: true
            }
          }
        },
        env_vars: []
      },
      {
        name: "newFuncTs",
        language: "typescript",
        timeout: 6,
        triggers: {
          default: {
            type: "http",
            active: true,
            options: {
              method: "Get",
              path: "/new-func-ts",
              preflight: true
            }
          }
        },
        env_vars: functions[2].env_vars
      }
    ]);

    functions.forEach(f =>
      f.env_vars.forEach(v => {
        expect(ObjectId.isValid(v)).toBe(true);
      })
    );
  });
});
