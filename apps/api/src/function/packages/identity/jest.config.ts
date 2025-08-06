const path = require("path");
const {workspaceRoot} = require("@nx/devkit");

const commonConfig = {
  preset: "../../../../../../jest.preset.js",
  testEnvironment: "node",
  coverageDirectory: path.join(workspaceRoot, "coverage/apps/api/function/packages/identity")
};

export default {
  projects: [
    {
      ...commonConfig,
      testMatch: ["<rootDir>/test/identity.spec.ts"],
      setupFilesAfterEnv: [path.join(workspaceRoot, "jest.flaky.setup.js")]
    },
    {
      ...commonConfig,
      testMatch: ["<rootDir>/test/**/*.spec.ts"]
    }
  ]
};
