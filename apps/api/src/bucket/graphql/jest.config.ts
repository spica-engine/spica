const path = require("path");
const {workspaceRoot} = require("@nx/devkit");

const commonConfig = {
  preset: "../../../../../jest.preset.js",
  testEnvironment: "node",
  coverageDirectory: path.join(workspaceRoot, "coverage/apps/api/bucket/graphql")
};

export default {
  projects: [
    {
      ...commonConfig,
      testMatch: ["<rootDir>/test/schema.spec.ts"]
    },
    {
      ...commonConfig,
      testMatch: ["<rootDir>/test/graphql.spec.ts"],
      setupFilesAfterEnv: [path.join(workspaceRoot, "jest.flaky.setup.js")]
    }
  ]
};
