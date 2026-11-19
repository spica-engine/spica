import dotenv from "dotenv";
import {mkdtempSync, readFileSync, rmSync, statSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {config} from "../src/config";
import {
  formatEntry,
  loadValueResolver,
  readValuesFile,
  upsertEntry,
  valuesFilePath
} from "../src/value-store";

describe("value store", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "spica-cli-values-"));
  });

  afterEach(() => {
    rmSync(dir, {recursive: true, force: true});
    jest.restoreAllMocks();
    delete process.env.SPICA_VALUE_A;
  });

  describe("formatEntry", () => {
    it.each([
      ["plain", "abc123"],
      ["empty", ""],
      ["spaces", "hello world"],
      ["hash", "a#b"],
      ["single quote", "it's"],
      ["multiline", "line1\nline2"],
      ["url", "postgres://u:p@host:5432/db?x=1"]
    ])("round-trips %s through dotenv", (_name, value) => {
      expect(dotenv.parse(formatEntry("K", value))).toEqual({K: value});
    });

    it("rejects values it cannot represent", () => {
      expect(() => formatEntry("K", `a"b\nc`)).toThrow(/not supported/);
    });
  });

  describe("upsertEntry", () => {
    it("creates the file with owner-only permissions", () => {
      const file = valuesFilePath(dir, "staging");

      upsertEntry(file, "A", "1");

      expect(readFileSync(file, "utf-8")).toBe("A=1\n");
      expect(statSync(file).mode & 0o777).toBe(0o600);
    });

    it("replaces an existing key and keeps comments and other keys", () => {
      const file = valuesFilePath(dir, "staging");
      upsertEntry(file, "A", "1");
      writeFileSync(file, `# note\nA=1\nB=2\n`);

      upsertEntry(file, "A", "changed");
      upsertEntry(file, "C", "3");

      expect(readFileSync(file, "utf-8")).toBe("# note\nA=changed\nB=2\nC=3\n");
    });
  });

  describe("readValuesFile", () => {
    it("returns an empty object when the file does not exist", () => {
      expect(readValuesFile(valuesFilePath(dir, "none"))).toEqual({});
    });
  });

  describe("loadValueResolver", () => {
    beforeEach(() => {
      jest.spyOn(config, "get").mockResolvedValue({context: "staging"});
    });

    it("prefers the shell over the values file of the current context", async () => {
      upsertEntry(valuesFilePath(dir, "staging"), "A", "from-file");
      upsertEntry(valuesFilePath(dir, "staging"), "B", "from-file");
      process.env.SPICA_VALUE_A = "from-shell";

      const resolver = await loadValueResolver(dir);

      expect(resolver.resolve("A")).toBe("from-shell");
      expect(resolver.resolve("B")).toBe("from-file");
      expect(resolver.resolve("C")).toBeUndefined();
    });

    it("ignores the values file of other contexts", async () => {
      upsertEntry(valuesFilePath(dir, "prod"), "B", "prod-value");

      expect((await loadValueResolver(dir)).resolve("B")).toBeUndefined();
    });
  });
});
