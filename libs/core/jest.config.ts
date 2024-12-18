const path = require("path");
const {workspaceRoot} = require("@nx/devkit");

export default {
  displayName: "core",
  preset: "../../jest.preset.js",
  testEnvironment: "node",
  coverageDirectory: path.join(workspaceRoot, "coverage/libs/core"),
  testMatch: ["<rootDir>/test/**/*.spec.ts"]
};
