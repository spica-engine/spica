import {Db, getConnectionUri, getDatabaseName, start} from "@spica-server/database/testing";
import color from "cli-color/lib/supports-color";
import {run} from "@spica/migrate";
import path from "path";

process.env.TESTONLY_MIGRATION_LOOKUP_DIR = path.join(process.cwd(), "dist/apps/migrate/src");

describe("Set MongoDB Feature Compatibility Version to 7.0", () => {
  let db: Db;
  let args: string[];

  beforeAll(() => {
    color.disableColor();
  });

  beforeEach(async () => {
    const connection = await start("standalone");
    args = ["--database-uri", await getConnectionUri(), "--database-name", getDatabaseName()];
    db = connection.db(args[3]);
  });

  it("should set featureCompatibilityVersion to 7.0", async () => {
    await run([...args, "--from", "0.16.0", "--to", "0.17.0", "--continue-if-versions-are-equal"]);

    const result = await db.admin().command({
      getParameter: 1,
      featureCompatibilityVersion: 1
    });

    expect(result.featureCompatibilityVersion.version).toBe("7.0");
  });
});
