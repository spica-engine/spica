import {createHash} from "crypto";
import {FunctionArtifactInputs} from "@spica-server/interface-function-asset-storage";

export function artifactPrefix(functionName: string): string {
  return `functions/${functionName}/artifacts/`;
}

export function isArtifactKey(key: string): boolean {
  return /^functions\/[^/]+\/artifacts\//.test(key);
}

export function artifactKey(
  functionName: string,
  inputs: FunctionArtifactInputs,
  platform: string
): string {
  const digest = createHash("sha256")
    .update(
      JSON.stringify({
        index: inputs.index,
        packageJson: inputs.packageJson,
        lockfile: inputs.lockfile,
        builder: inputs.builder,
        platform
      })
    )
    .digest("hex");
  return `${artifactPrefix(functionName)}${digest}.tar.gz`;
}

// Native addons (sharp, bcrypt, ...) built for one platform crash on another, so every field that
// changes the binary interface of node_modules is part of the artifact key.
export function platformId(): string {
  const header = (process.report?.getReport() as any)?.header;
  const libc = process.platform == "linux" ? (header?.glibcVersionRuntime ? "glibc" : "musl") : "";
  return [process.platform, process.arch, libc, `abi${process.versions.modules}`]
    .filter(Boolean)
    .join("-");
}
