const path = require("path");
const {workspaceRoot} = require("@nx/devkit");

const commonConfig = {
  preset: "../../../../../jest.preset.js",
  testEnvironment: "node",
  coverageDirectory: path.join(workspaceRoot, "coverage/apps/api/function/log")
};

export default {
  projects: [
    {
      ...commonConfig,
      testMatch: ["<rootDir>/test/authorization.spec.ts", "<rootDir>/test/service.spec.ts"]
    },
    {
      ...commonConfig,
      testMatch: ["<rootDir>/test/realtime.spec.ts"]
      // setupFilesAfterEnv: [path.join(workspaceRoot, "jest.flaky.setup.js")]
    }
  ]
};
