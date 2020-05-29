import * as fs from "fs";
import {loadMigrations} from "../src/migrate";

describe("Migrate", () => {
  it("should load migrations", () => {
    const migrations = {};
    fs.writeFileSync("migrations/index.json", JSON.stringify(migrations));
    expect(loadMigrations()).toEqual(migrations);
  });
});
