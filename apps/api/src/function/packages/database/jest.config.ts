const path = require("path");
const {workspaceRoot} = require("@nx/devkit");

const commonConfig = {
  preset: "../../../../../../jest.preset.js",
  testEnvironment: "node",
  coverageDirectory: path.join(workspaceRoot, "coverage/apps/api/function/packages/database")
};

export default {
  projects: [
    {
      ...commonConfig,
      testMatch: ["<rootDir>/test/*.spec.ts"]
    },
    {
      ...commonConfig,
      testMatch: ["<rootDir>/test/database.e2e.spec.ts"],
      setupFilesAfterEnv: [path.join(workspaceRoot, "jest.flaky.setup.js")]
    }
  ]
};
