import {
  Db,
  getConnectionUri,
  getDatabaseName,
  start,
  stopServer
} from "@spica-server/database/testing";
import color from "cli-color/lib/supports-color";
import {run} from "@spica/migrate";
import path from "path";
import fs from "fs";

process.env.TESTONLY_MIGRATION_LOOKUP_DIR = path.join(process.cwd(), "dist/apps/migrate/src");

describe("Set FCV(Feature Compatibility Version) to 4.4", () => {
  let db: Db;
  let args: string[];

  beforeAll(() => {
    color.disableColor();
  });

  beforeEach(() => {});

  it("should set fcv to 4.4", async () => {
    const migrationDbPath = fs.mkdtempSync(path.join(process.env.TEST_TMPDIR, "db-migration-"));
    // to mimic our servers
    const oldDb = await start("replset", "4.2.0", migrationDbPath);
    await oldDb
      .db()
      .admin()
      .command({
        getParameter: 1,
        featureCompatibilityVersion: 1
      })
      .then(console.log);
    await oldDb.close(false);
    await stopServer(false, false);
    const connection = await start("replset", "4.4.0", migrationDbPath);
    await connection
      .db()
      .admin()
      .command({
        getParameter: 1,
        featureCompatibilityVersion: 1
      })
      .then(console.log);
    args = ["--database-uri", await getConnectionUri(), "--database-name", getDatabaseName()];
    db = connection.db(args[3]);

    // throw Error(getDbPath());
    // await db.admin().command({
    //   setFeatureCompatibilityVersion: "4.2"
    // });
    // let fcv = await db
    //   .admin()
    //   .command({
    //     getParameter: 1,
    //     featureCompatibilityVersion: 1
    //   })
    //   .then(r => r.featureCompatibilityVersion.version);
    // expect(fcv).toEqual("4.2");

    // await run([...args, "--from", "0.9.29", "--to", "0.10.0", "--continue-if-versions-are-equal"]);

    const fcv = await db
      .admin()
      .command({
        getParameter: 1,
        featureCompatibilityVersion: 1
      })
      .then(r => r.featureCompatibilityVersion.version);
    expect(fcv).toEqual("");
  }, 60000);
});
