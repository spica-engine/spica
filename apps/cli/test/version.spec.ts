import {mkdtempSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {readPackageVersion} from "../src/version";

describe("readPackageVersion", () => {
  it("should read package version relative to the runtime entrypoint", () => {
    expect(readPackageVersion(new URL("../index.ts", import.meta.url))).toBe("0.0.0-PLACEHOLDER");
  });

  it("should throw when package version is missing", () => {
    const directory = mkdtempSync(join(tmpdir(), "spica-cli-version-"));

    try {
      writeFileSync(join(directory, "package.json"), JSON.stringify({name: "@spica/cli"}));

      expect(() => readPackageVersion(new URL(`file://${directory}/index.js`))).toThrow(
        `Missing version in '${directory}/package.json'`
      );
    } finally {
      rmSync(directory, {recursive: true, force: true});
    }
  });
});
