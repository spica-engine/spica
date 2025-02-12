import nxPreset from "@nx/jest/preset.js";
import path from "path";
import {fileURLToPath} from "url";
import {pathsToModuleNameMapper} from "ts-jest";
import tsconfig from "./tsconfig.json" with {type: "json"};
import {workspaceRoot} from "@nx/devkit";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  ...nxPreset,
  transform: {
    "^.+\.m?tsx?$": ["ts-jest", {useESM: true}]
  },
  testEnvironment: "node",
  setupFilesAfterEnv: [path.join(__dirname, "jest.setup.js")],
  moduleNameMapper: pathsToModuleNameMapper(tsconfig.compilerOptions.paths, {
    prefix: workspaceRoot
  }),
  extensionsToTreatAsEsm: [".ts", ".tsx", ".mts"]
};
