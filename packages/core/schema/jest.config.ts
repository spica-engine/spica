const path = require("path");
const {workspaceRoot} = require("@nx/devkit");

export default {
  preset: "../../../jest.preset.js",
  testEnvironment: "node",
  coverageDirectory: path.join(workspaceRoot, "coverage/packages/core/schema"),
  testMatch: ["<rootDir>/test/**/*.spec.ts"]
};
