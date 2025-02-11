import {Db, getConnectionUri, getDatabaseName, start} from "@spica-server/database/testing";
import * as color from "cli-color/lib/supports-color";
import * as fs from "fs";
import {run} from "@spica/migrate";

describe("Basic behavior", () => {
  let db: Db;
  let args: string[];
  const indexJsonPath = process.env.TESTONLY_MIGRATION_LOOKUP_DIR + "/migrations/index.json";

  beforeAll(() => {
    color.disableColor();
  });

  beforeEach(async () => {
    fs.writeFileSync(
      indexJsonPath,
      JSON.stringify({
        "1.0.0": [
          process.env.TESTONLY_MIGRATION_LOOKUP_DIR + "/migrations/insert_an_item",
          process.env.TESTONLY_MIGRATION_LOOKUP_DIR + "/migrations/modify_an_item"
        ],
        "2.0.0": [process.env.TESTONLY_MIGRATION_LOOKUP_DIR + "/migrations/add_description"]
      })
    );
    const connection = await start("replset");
    args = ["--database-uri", await getConnectionUri(), "--database-name", getDatabaseName()];
    db = connection.db(args[3]);
    await db.createCollection("_test_");
  });

  afterEach(() => {
    if (fs.existsSync(indexJsonPath)) {
      fs.unlinkSync(indexJsonPath);
    }
  });

  it("should throw an error when --to is not valid", async () => {
    const error = await run([...args, "--from", "0.1.0", "--to", "00-not-valid"]).catch(e => e);
    expect(error).toEqual(new TypeError("--from or --to was not a valid semver string."));
  });

  it("should throw an error when --from is not valid", async () => {
    const error = await run([...args, "--from", "00-not-valid", "--to", "0.1.0"]).catch(e => e);
    expect(error).toEqual(new TypeError("--from or --to was not a valid semver string."));
  });

  it("should throw an error when --from and --to are equal", async () => {
    const error = await run([...args, "--from", "0.1.0", "--to", "0.1.0"]).catch(e => e);
    expect(error).toEqual(new TypeError("--from and --to can not be equal."));
  });

  it("should skip migration when --from and --to are equal", async () => {
    const result = await run([
      ...args,
      "--from",
      "0.1.0",
      "--to",
      "0.1.0",
      "--continue-if-versions-are-equal",
      "true"
    ]);
    expect(result).toBeFalsy();
  });

  it("should throw an error when --from greater than --to", async () => {
    const error = await run([...args, "--from", "1.1.0", "--to", "0.1.0"]).catch(e => e);
    expect(error).toEqual(new TypeError("--from must not be greater than --to."));
  });
});
