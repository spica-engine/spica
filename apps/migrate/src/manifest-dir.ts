import path from "path";
import {fileURLToPath} from "url";

export function getManifestDir() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  let manifestDir = __dirname;
  const isTestEnv = process.env.NODE_ENV == "test";
  if (isTestEnv) {
    manifestDir = process.env.TESTONLY_MIGRATION_LOOKUP_DIR;
  }
  return manifestDir;
}
