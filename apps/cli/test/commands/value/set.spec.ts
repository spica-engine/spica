import {mkdirSync, mkdtempSync, readFileSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {ENV, SECRET, saveValue} from "../../../src/commands/value/set";

describe("saveValue", () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), "spica-cli-set-"));
    mkdirSync(join(rootDir, "env-var", "API_URL"), {recursive: true});
    mkdirSync(join(rootDir, "secret", "DB_PASSWORD"), {recursive: true});
  });

  afterEach(() => rmSync(rootDir, {recursive: true, force: true}));

  it("writes a declared env var to the values file of the context", () => {
    const file = saveValue(ENV, {rootDir, contextName: "staging", key: "API_URL", value: "x"});

    expect(file).toBe(join(rootDir, ".spica", "staging.env"));
    expect(readFileSync(file, "utf-8")).toBe("API_URL=x\n");
  });

  it("writes a declared secret", () => {
    const file = saveValue(SECRET, {
      rootDir,
      contextName: "prod",
      key: "DB_PASSWORD",
      value: "p w"
    });

    expect(readFileSync(file, "utf-8")).toBe("DB_PASSWORD='p w'\n");
  });

  it("rejects keys that are not declared in the project", () => {
    expect(() =>
      saveValue(ENV, {rootDir, contextName: "staging", key: "UNKNOWN", value: "x"})
    ).toThrow(/env-var\/UNKNOWN\/schema.yaml/);
  });

  it("does not accept a secret key as an env var", () => {
    expect(() =>
      saveValue(ENV, {rootDir, contextName: "staging", key: "DB_PASSWORD", value: "x"})
    ).toThrow(/not declared/);
  });
});
