import os from "os";
import path from "path";
import fs from "fs";
import yaml from "yaml";
import {bucketModule, secretModule} from "@spica-server/sync";
import {
  findLocalSecretsWithValues,
  renderSecretValueWarnings
} from "@spica/cli/src/commands/sync/secret-warning";

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "spica-secret-warning-test-"));
}

function cleanup(dir: string) {
  fs.rmSync(dir, {recursive: true, force: true});
}

describe("findLocalSecretsWithValues", () => {
  it("returns secret keys whose local schema includes a non-empty value", async () => {
    const dir = makeTmpDir();
    try {
      const withValueDir = path.join(dir, "secret", "API_KEY");
      const withoutValueDir = path.join(dir, "secret", "DB_PASS");

      fs.mkdirSync(withValueDir, {recursive: true});
      fs.mkdirSync(withoutValueDir, {recursive: true});

      fs.writeFileSync(
        path.join(withValueDir, "schema.yaml"),
        yaml.stringify({key: "API_KEY", value: "super-secret"})
      );
      fs.writeFileSync(path.join(withoutValueDir, "schema.yaml"), yaml.stringify({key: "DB_PASS"}));

      await expect(findLocalSecretsWithValues([secretModule], dir)).resolves.toEqual(["API_KEY"]);
    } finally {
      cleanup(dir);
    }
  });

  it("returns empty when secret module is not part of the selected modules", async () => {
    const dir = makeTmpDir();
    try {
      await expect(findLocalSecretsWithValues([bucketModule], dir)).resolves.toEqual([]);
    } finally {
      cleanup(dir);
    }
  });
});

describe("renderSecretValueWarnings", () => {
  it("prints the warning text and proceed note", () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    renderSecretValueWarnings(["API_KEY"]);

    const output = logSpy.mock.calls.map(call => String(call[0])).join("\n");
    expect(output).toContain("secret(API_KEY) includes value in the local files");
    expect(output).toContain("Proceeding will still send local secret values");

    logSpy.mockRestore();
  });

  it("prints nothing when there are no matching secrets", () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    renderSecretValueWarnings([]);

    expect(logSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });
});
