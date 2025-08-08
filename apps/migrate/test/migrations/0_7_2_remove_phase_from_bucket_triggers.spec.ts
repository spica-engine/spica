import {Db, getConnectionUri, getDatabaseName, start} from "../../../../libs/database/testing";
import color from "cli-color/lib/supports-color";
import {run} from "@spica/migrate";
import path from "path";

process.env.TESTONLY_MIGRATION_LOOKUP_DIR = path.join(process.cwd(), "dist/apps/migrate/src");

describe("remove phase from bucket triggers", () => {
  let db: Db;
  let args: string[];

  beforeAll(() => {
    color.disableColor();
  });

  beforeEach(async () => {
    const connection = await start("replset");
    args = ["--database-uri", await getConnectionUri(), "--database-name", getDatabaseName()];
    db = connection.db(args[3]);
    await db.collection("function").insertOne({
      triggers: {
        default: {
          options: {
            bucket: "5f31001c4a51a68d6fec4d3d",
            type: "INSERT",
            phase: "AFTER"
          },
          type: "bucket"
        },
        default1: {
          options: {
            bucket: "5f31001c4a51a68d6fec4d3d",
            type: "INSERT",
            phase: "BEFORE"
          },
          type: "bucket"
        },
        default2: {
          options: {
            preflight: true,
            path: "/test"
          },
          type: "http"
        }
      }
    });
  });

  it("should remove phase from triggers", async () => {
    await run([...args, "--from", "0.7.1", "--to", "0.7.2", "--continue-if-versions-are-equal"]);
    const fn = await db.collection("function").findOne({});
    delete fn._id;
    expect(fn).toEqual({
      triggers: {
        default: {
          options: {
            bucket: "5f31001c4a51a68d6fec4d3d",
            type: "INSERT"
          },
          type: "bucket"
        },
        default1: {
          options: {
            bucket: "5f31001c4a51a68d6fec4d3d",
            type: "INSERT"
          },
          type: "bucket"
        },
        default2: {
          options: {
            preflight: true,
            path: "/test"
          },
          type: "http"
        }
      }
    });
  });
});
