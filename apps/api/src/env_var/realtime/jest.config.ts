const path = require("path");
const {workspaceRoot} = require("@nx/devkit");

export default {
  preset: "../../../../../jest.preset.js",
  testEnvironment: "node",
  coverageDirectory: path.join(workspaceRoot, "coverage/apps/api/env_var/realtime"),
  testMatch: ["<rootDir>/test/**/*.spec.ts"],
  setupFilesAfterEnv: [path.join(workspaceRoot, "jest.flaky.setup.js")]
};
