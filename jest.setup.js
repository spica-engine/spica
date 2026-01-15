import fs from "fs";
import path from "path";
import os from "os";
import {workspaceRoot} from "@nx/devkit";
import {jest} from "@jest/globals";

global.jest = jest;
jest.setTimeout(60_000);

// directory for all tests
const testTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "jest-"));
process.env.TEST_TMPDIR = testTmpDir;

// directory for migration tests
process.env.TESTONLY_MIGRATION_LOOKUP_DIR = path.join(
  process.cwd(),
  "dist/apps/migrate/test/acceptance"
);

// directory for function spawned worker entrypoints
process.env.FUNCTION_SPAWN_ENTRYPOINT_PATH = path.join(
  workspaceRoot,
  "dist",
  "apps",
  "api",
  "src",
  "function",
  "runtime",
  "node",
  "bootstrap",
  "entrypoint.js"
);

// directory for function typescript compiler worker path
process.env.FUNCTION_TS_COMPILER_PATH = path.join(
  workspaceRoot,
  "dist",
  "apps",
  "api",
  "src",
  "function",
  "compiler",
  "typescript",
  "src",
  "typescript_worker.js"
);

afterAll(async () => {
  if (fs.existsSync(testTmpDir)) {
    fs.rmSync(testTmpDir, {recursive: true, force: true});
  }

  if (globalThis.__CLEANUPCALLBACKS) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    await Promise.all(globalThis.__CLEANUPCALLBACKS.map(callback => callback()));
  }
});
