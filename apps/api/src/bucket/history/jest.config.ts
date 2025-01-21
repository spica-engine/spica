const path = require("path");
const {workspaceRoot} = require("@nx/devkit");

const commonConfig = {
  preset: "../../../../../jest.preset.js",
  testEnvironment: "node",
  coverageDirectory: path.join(workspaceRoot, "coverage/apps/api/bucket/history")
};

export default {
  projects: [
    {
      ...commonConfig,
      testMatch: ["<rootDir>/test/history.service.spec.ts", "<rootDir>/test/path.spec.ts"]
    },
    {
      ...commonConfig,
      testMatch: ["<rootDir>/test/history.controller.spec.ts"],
      setupFilesAfterEnv: [path.join(workspaceRoot, "jest.flaky.setup.js")]
    }
  ]
};
