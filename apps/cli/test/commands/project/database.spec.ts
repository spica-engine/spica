import {
  databaseApiArgs,
  databaseImage,
  isDatabaseImage,
  postgresContainerEnv
} from "@spica/cli/src/commands/project/database";

describe("project database", () => {
  const versions = {mongo: "8.0", postgres: "18"};

  describe("databaseImage", () => {
    it("should pick the mongo image by default engine", () => {
      expect(databaseImage("mongodb", versions)).toEqual({image: "mongo", tag: "8.0"});
    });

    it("should pick the postgres image for postgresql", () => {
      expect(databaseImage("postgresql", versions)).toEqual({image: "postgres", tag: "18"});
    });
  });

  describe("isDatabaseImage", () => {
    it.each(["mongo:8.0", "postgres:18", "mongo"])("should detect %s", image => {
      expect(isDatabaseImage(image)).toBe(true);
    });

    it.each(["nginx:latest", "spicaengine/api:latest", "spicaengine/panel:1"])(
      "should not detect %s",
      image => {
        expect(isDatabaseImage(image)).toBe(false);
      }
    );
  });

  describe("databaseApiArgs", () => {
    it("should keep the mongodb arguments unchanged", () => {
      expect(databaseApiArgs("mongodb", "demo", "demo-db")).toEqual([
        "--database-name=demo",
        "--database-replica-set=demo",
        '--database-uri="mongodb://demo-db-0,demo-db-1,demo-db-2"'
      ]);
    });

    it("should point the api at the postgres container", () => {
      expect(databaseApiArgs("postgresql", "demo", "demo-db")).toEqual([
        "--database-type=postgresql",
        "--database-uri=postgres://spica:spica@demo-db-0:5432/demo"
      ]);
    });
  });

  it("should create the postgres database named after the project", () => {
    expect(postgresContainerEnv("demo")).toEqual([
      "POSTGRES_USER=spica",
      "POSTGRES_PASSWORD=spica",
      "POSTGRES_DB=demo"
    ]);
  });
});
