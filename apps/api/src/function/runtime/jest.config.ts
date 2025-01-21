const path = require("path");
const {workspaceRoot} = require("@nx/devkit");

const commonConfig = {
  preset: "../../../../../jest.preset.js",
  testEnvironment: "node",
  coverageDirectory: path.join(workspaceRoot, "coverage/apps/api/function/runtime")
};

export default {
  projects: [
    {
      ...commonConfig,
      testMatch: ["<rootDir>/test/node/entrypoint.spec.ts"]
    },
    {
      ...commonConfig,
      testMatch: ["<rootDir>/test/node/node.spec.ts", "<rootDir>/test/io/*.spec.ts"],
      setupFilesAfterEnv: [path.join(workspaceRoot, "jest.flaky.setup.js")]
    }
  ]
};
