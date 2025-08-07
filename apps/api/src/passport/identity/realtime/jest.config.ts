const path = require("path");
const {workspaceRoot} = require("@nx/devkit");

export default {
  preset: "../../../../../../jest.preset.js",
  testEnvironment: "node",
  coverageDirectory: path.join(workspaceRoot, "coverage/apps/api/passport/identity/realtime"),
  testMatch: ["<rootDir>/test/**/*.spec.ts"],
  setupFilesAfterEnv: ["../../../../../../jest.flaky.setup.js"]
};
