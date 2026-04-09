import {readFileSync} from "node:fs";

type PackageJson = {
  version?: unknown;
};

export function readPackageVersion(baseUrl: string | URL): string {
  const packageJsonUrl = new URL("./package.json", baseUrl);
  const pkg = JSON.parse(readFileSync(packageJsonUrl, "utf8")) as PackageJson;

  if (typeof pkg.version != "string" || !pkg.version) {
    throw new Error(`Missing version in '${packageJsonUrl.pathname}'`);
  }

  return pkg.version;
}
