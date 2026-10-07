import {
  artifactKey,
  artifactPrefix,
  isArtifactKey,
  platformId
} from "@spica-server/function/src/asset-keys";

const inputs = {index: "i", packageJson: "p", lockfile: "l", builder: "legacy"};

describe("artifactKey", () => {
  it("should be stable for identical inputs and platform", () => {
    expect(artifactKey("fn", inputs, "linux-x64")).toBe(
      artifactKey("fn", {...inputs}, "linux-x64")
    );
  });

  it("should live under the function's artifact prefix", () => {
    const key = artifactKey("fn", inputs, "linux-x64");
    expect(key.startsWith(artifactPrefix("fn"))).toBe(true);
    expect(key).toMatch(/^functions\/fn\/artifacts\/[0-9a-f]{64}\.tar\.gz$/);
  });

  it.each([
    ["index", {...inputs, index: "other"}],
    ["package.json", {...inputs, packageJson: "other"}],
    ["lockfile", {...inputs, lockfile: null}],
    ["builder", {...inputs, builder: "rollup"}]
  ])("should change when the %s input changes", (_, changed) => {
    expect(artifactKey("fn", changed, "linux-x64")).not.toBe(
      artifactKey("fn", inputs, "linux-x64")
    );
  });

  it("should change with the platform", () => {
    expect(artifactKey("fn", inputs, "linux-arm64")).not.toBe(
      artifactKey("fn", inputs, "linux-x64")
    );
  });
});

describe("isArtifactKey", () => {
  it("should only match archive keys", () => {
    expect(isArtifactKey("functions/fn/artifacts/abc.tar.gz")).toBe(true);
    expect(isArtifactKey("functions/fn/index.ts")).toBe(false);
    expect(isArtifactKey("functions/artifacts/index.ts")).toBe(false);
  });
});

describe("platformId", () => {
  it("should include platform, arch and node ABI", () => {
    const id = platformId();
    expect(id).toContain(process.platform);
    expect(id).toContain(process.arch);
    expect(id).toContain(`abi${process.versions.modules}`);
  });
});
