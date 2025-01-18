const path = require("path");
const {workspaceRoot} = require("@nx/devkit");

const commonConfig = {
  preset: "../../../../jest.preset.js",
  testEnvironment: "node",
  coverageDirectory: path.join(workspaceRoot, "coverage/apps/api/asset")
};

export default {
  projects: [
    {
      ...commonConfig,
      testMatch: ["<rootDir>/test/e2e.spec.ts", "<rootDir>/test/helpers.spec.ts"]
    },
    {
      ...commonConfig,
      testMatch: ["<rootDir>/test/*.e2e.spec.ts"],
      setupFilesAfterEnv: [path.join(workspaceRoot, "jest.flaky.setup.js")]
    }
  ]
};
