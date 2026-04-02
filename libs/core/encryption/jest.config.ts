const path = require("node:path");
const {workspaceRoot} = require("@nx/devkit");

export default {
  preset: "../../../jest.preset.js",
  testEnvironment: "node",
  coverageDirectory: path.join(workspaceRoot, "coverage/libs/core/encryption"),
  testMatch: ["<rootDir>/test/**/*.spec.ts"]
};
