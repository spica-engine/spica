import {Db, getConnectionUri, getDatabaseName, start} from "@spica-server/database-testing";
import color from "cli-color/lib/supports-color";
import {run} from "@spica/migrate";
import path from "path";

process.env.TESTONLY_MIGRATION_LOOKUP_DIR = path.join(process.cwd(), "dist/src");

jest.setTimeout(120_000);

describe("Remove memoryLimit from functions", () => {
  let db: Db;
  let args: string[];

  beforeAll(() => {
    color.disableColor();
  });

  beforeEach(async () => {
    const connection = await start("replset");
    args = ["--database-uri", await getConnectionUri(), "--database-name", getDatabaseName()];
    db = connection.db(args[3]);
  });

  it("should unset memoryLimit across functions while preserving every other field", async () => {
    const triggers = {default: {type: "http", active: true, options: {method: "Get", path: "/"}}};

    await db.collection("function").insertMany([
      {name: "a", language: "javascript", timeout: 10, memoryLimit: 100, triggers},
      {name: "b", language: "javascript", timeout: 20},
      {name: "c", language: "typescript", timeout: 30, memoryLimit: 512}
    ]);

    await run([...args, "--from", "0.19.5", "--to", "0.19.6", "--continue-if-versions-are-equal"]);

    const fns = await db.collection("function").find({}).sort({name: 1}).toArray();

    expect(fns.every(fn => !("memoryLimit" in fn))).toBe(true);
    expect(fns.map(fn => [fn.name, fn.language, fn.timeout])).toEqual([
      ["a", "javascript", 10],
      ["b", "javascript", 20],
      ["c", "typescript", 30]
    ]);
    expect(fns[0].triggers).toEqual(triggers);
  });
});
