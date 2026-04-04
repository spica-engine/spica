import nxPreset from "@nx/jest/preset.js";
import path from "path";
import {fileURLToPath} from "url";
import {pathsToModuleNameMapper} from "ts-jest";
import tsconfig from "./tsconfig.json" with {type: "json"};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = __dirname;

export default {
  ...nxPreset,
  transform: {
    "^.+\\.m?tsx?$": ["ts-jest", {useESM: true}]
  },
  testEnvironment: "node",
  setupFilesAfterEnv: [path.join(__dirname, "jest.setup.js")],
  moduleNameMapper: {
    ...pathsToModuleNameMapper(tsconfig.compilerOptions.paths, {
      prefix: workspaceRoot
    }),
    "^rxjs(/.*)?$": path.join(workspaceRoot, "node_modules/rxjs/dist/cjs$1")
  },
  extensionsToTreatAsEsm: [".ts", ".tsx", ".mts"]
};
