import fs from "fs";
import {loadMigrations, migrationVersions, getMigrations} from "@spica/migrate";
import path from "path";

function updateMigrationManifest(migrations: any) {
  fs.writeFileSync(
    process.env.TESTONLY_MIGRATION_LOOKUP_DIR + "/migrations/index.json",
    JSON.stringify(migrations)
  );
}

describe("Migrate", () => {
  it("should load migrations", () => {
    const migrations = {
      "1.0.0": []
    };
    updateMigrationManifest(migrations);
    expect(loadMigrations()).toEqual(migrations);
  });

  it("should get migration versions in order", () => {
    updateMigrationManifest({
      "1.0.0": [],
      "1.1.1": [],
      "2.1.0-next": [],
      "2.3.0": [],
      "0.4.0": [],
      "4.0.0": [],
      "3.0.0": []
    });
    expect(migrationVersions("0.0.1", "3.0.0")).toEqual([
      "0.4.0",
      "1.0.0",
      "1.1.1",
      "2.1.0-next",
      "2.3.0",
      "3.0.0"
    ]);
  });

  it("should get migration scripts", () => {
    updateMigrationManifest({
      "1.0.0": ["1.0.0/update-language", "1.0.0/drop-testing-collection"]
    });
    expect(getMigrations("1.0.0")).toEqual([
      path.join(process.env.TESTONLY_MIGRATION_LOOKUP_DIR, "migrations/1.0.0/update-language"),
      path.join(
        process.env.TESTONLY_MIGRATION_LOOKUP_DIR,
        "migrations/1.0.0/drop-testing-collection"
      )
    ]);
  });
});
