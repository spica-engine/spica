const path = require("path");
const {workspaceRoot} = require("@nx/devkit");

export default {
  preset: "../../../../jest.preset.js",
  testEnvironment: "node",
  coverageDirectory: path.join(workspaceRoot, "coverage/libs/api/status/services"),
  testMatch: ["<rootDir>/**/*.spec.ts"],
  setupFilesAfterEnv: [path.join(workspaceRoot, "jest.flaky.setup.js")]
};
