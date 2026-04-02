const path = require("path");
const {workspaceRoot} = require("@nx/devkit");

const commonConfig = {
  preset: "../../../../../jest.preset.js",
  testEnvironment: "node",
  coverageDirectory: path.join(workspaceRoot, "coverage/apps/api/passport/identity")
};

export default {
  projects: [
    {
      ...commonConfig,
      testMatch: ["<rootDir>/test/**/*.spec.ts"]
    }
  ]
};
