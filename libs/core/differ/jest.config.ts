const path = require("path");
const {workspaceRoot} = require("@nx/devkit");

export default {
  displayName: "core/differ",
  preset: "../../../jest.preset.js",
  testEnvironment: "node",
  coverageDirectory: path.join(workspaceRoot, "coverage/libs/core/differ"),
  testMatch: ["<rootDir>/test/**/*.spec.ts"]
};
