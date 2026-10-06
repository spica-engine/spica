import {describe, expect, it} from "@jest/globals";
import {
  DATABASE_CREATE_CHECK,
  MissingPrivilegeError,
  missingSchemaPrivileges,
  schemaPrivilegeCheck
} from "@spica-server/database-postgres";

describe("the privilege check", () => {
  it("produces the database-level CREATE query", () => {
    expect(DATABASE_CREATE_CHECK).toContain("has_database_privilege(current_database(), 'CREATE')");
  });

  it("asks for the USAGE and CREATE privileges of the four schemas", () => {
    const sql = schemaPrivilegeCheck();
    for (const schema of ["bucket", "rel", "spica", "app"]) {
      expect(sql).toContain(`has_schema_privilege('${schema}', 'USAGE')`);
      expect(sql).toContain(`has_schema_privilege('${schema}', 'CREATE')`);
    }
  });

  it("no privilege is missing when everything is in place", () => {
    const row: Record<string, boolean> = {};
    for (const schema of ["bucket", "rel", "spica", "app"]) {
      row[`${schema}_usage`] = true;
      row[`${schema}_create`] = true;
    }
    expect(missingSchemaPrivileges(row)).toEqual([]);
  });

  /** The symptom used to appear at use time and far away; the error now names the missing privilege. */
  it("reports the missing privilege by name", () => {
    const row: Record<string, boolean> = {};
    for (const schema of ["bucket", "rel", "spica", "app"]) {
      row[`${schema}_usage`] = true;
      row[`${schema}_create`] = true;
    }
    row["bucket_create"] = false;
    row["spica_usage"] = false;

    expect(missingSchemaPrivileges(row)).toEqual([
      "CREATE on schema bucket",
      "USAGE on schema spica"
    ]);
  });

  it("the error message says superuser is not required", () => {
    const error = new MissingPrivilegeError(["CREATE on the database"]);
    expect(error.message).toContain("CREATE on the database");
    expect(error.message).toContain("REPLICATION and superuser are not needed");
    expect(error.missing).toEqual(["CREATE on the database"]);
  });
});
