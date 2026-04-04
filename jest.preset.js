import nxPreset from "@nx/jest/preset.js";
import path from "path";
import {fileURLToPath} from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  ...nxPreset,
  transform: {
    "^.+\.m?tsx?$": ["ts-jest", {useESM: true, diagnostics: false}]
  },
  testEnvironment: "node",
  resolver: path.join(__dirname, "jest.resolver.cjs"),
  setupFilesAfterEnv: [path.join(__dirname, "jest.setup.js")],
  extensionsToTreatAsEsm: [".ts", ".tsx", ".mts"]
};
