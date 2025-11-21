const path = require("path");
const {workspaceRoot} = require("@nx/devkit");

const commonConfig = {
  preset: "../../../../jest.preset.js",
  testEnvironment: "node",
  coverageDirectory: path.join(workspaceRoot, "coverage/apps/api/versioncontrol")
};

export default {
  projects: [
    {
      ...commonConfig,
      testMatch: ["<rootDir>/test/engine.spec.ts"]
    }
    // {
    //   ...commonConfig,
    //   testMatch: ["<rootDir>/test/integration.spec.ts"]
    // },
    // {
    //   ...commonConfig,
    //   testMatch: ["<rootDir>/test/e2e.spec.ts"],
    //   setupFilesAfterEnv: [path.join(workspaceRoot, "jest.flaky.setup.js")]
    // },
    // {
    //   ...commonConfig,
    //   testMatch: ["<rootDir>/test/representative.spec.ts"],
    //   setupFilesAfterEnv: [path.join(workspaceRoot, "jest.flaky.setup.js")]
    // }
  ]
};
