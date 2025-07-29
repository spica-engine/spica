const path = require("path");
const {workspaceRoot} = require("@nx/devkit");

export default {
  preset: "../../../../../jest.preset.js",
  testEnvironment: "node",
  coverageDirectory: path.join(workspaceRoot, "coverage/apps/api/passport/policy"),
  testMatch: ["<rootDir>/realtime/test/**/*.spec.ts"]
};
