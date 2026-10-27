import {migrate, run} from "@spica/migrate";

describe("Engine switch", () => {
  const baseArgs = ["--database-uri", "mongodb://localhost", "--from", "0.1.0", "--to", "0.2.0"];

  it("should require --database-name for mongodb by default", async () => {
    await expect(run(baseArgs)).rejects.toThrow("--database-name is required");
  });

  it("should not require --database-name for postgresql", async () => {
    await expect(run([...baseArgs, "--database-type", "postgresql"])).rejects.not.toThrow(
      "--database-name is required"
    );
  });

  it("should reject unknown database types", async () => {
    await expect(run([...baseArgs, "--database-type", "mysql"])).rejects.toBeDefined();
  });

  it("should dispatch postgresql to its own track", async () => {
    await expect(
      migrate({
        databaseType: "postgresql",
        from: "0.1.0",
        to: "0.2.0",
        console,
        database: {uri: "postgres://localhost/spica", name: undefined}
      })
    ).rejects.toThrow("PostgreSQL migrations are not supported yet.");
  });
});
