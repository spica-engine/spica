const path = require("path");
const {workspaceRoot} = require("@nx/devkit");

export default {
  preset: "../../jest.preset.js",
  testEnvironment: "node",
  coverageDirectory: path.join(workspaceRoot, "coverage/apps/cli"),
  modulePathIgnorePatterns: ["<rootDir>/test/commands/bucket/schema.spec.ts"],
  testMatch: ["<rootDir>/test/**/*.spec.ts"]
};
