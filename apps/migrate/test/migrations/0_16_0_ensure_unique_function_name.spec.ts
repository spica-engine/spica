import { Db, getConnectionUri, getDatabaseName, start } from "@spica-server/database/testing";
import color from "cli-color/lib/supports-color";
import { run } from "@spica/migrate";
import path from "path";

process.env.TESTONLY_MIGRATION_LOOKUP_DIR = path.join(process.cwd(), "dist/apps/migrate/src");

describe("Ensure unique function name migration", () => {
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
      { name: "dupFunc", env: {} },
      { name: "dupFunc", env: {} },
      { name: "dupFunc", env: {} },
      { name: "another", env: {} },
      { name: "another", env: {} },
      { name: "func", env: {} }
    ]);
  });

  it("should rename duplicate function names to have numeric suffixes and create unique index", async () => {
    await run([...args, "--from", "0.15.0", "--to", "0.16.0", "--continue-if-versions-are-equal"]);

    const dupDocs = await db
      .collection("function")
      .find({})
      .sort({ _id: 1 })
      .map(obj => obj.name)
      .toArray();

    expect(dupDocs).toEqual(["dupFunc", "dupFunc(1)", "dupFunc(2)", "another", "another(1)", "func"]);
  });
});
