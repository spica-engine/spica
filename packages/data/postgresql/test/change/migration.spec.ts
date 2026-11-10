import fs from "fs";
import path from "path";
import {changeFunctionSql, changeSequenceSql} from "../../src/change/sql.js";

describe("change trigger migration", () => {
  const script = fs
    .readFileSync(
      path.join(
        process.cwd(),
        "../../../apps/migrate/src/postgresql/migrations/0.21.0/change-triggers.sql"
      )
    )
    .toString();

  it("should install the sequence the API installs", () => {
    expect(script).toContain(changeSequenceSql);
  });

  it("should install the function the API installs", () => {
    expect(script).toContain(changeFunctionSql);
  });
});
