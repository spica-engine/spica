const path = require("path");
const {workspaceRoot} = require("@nx/devkit");

export default {
  preset: "../../../jest.preset.js",
  testEnvironment: "node",
  coverageDirectory: path.join(workspaceRoot, "coverage/libs/api/mailer"),
  testMatch: ["<rootDir>/test/**/*.spec.ts"]
};