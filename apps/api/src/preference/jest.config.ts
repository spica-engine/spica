const path = require("path");
const {workspaceRoot} = require("@nx/devkit");

const commonConfig = {
  preset: "../../../../jest.preset.js",
  testEnvironment: "node",
  coverageDirectory: path.join(workspaceRoot, "coverage/apps/api/preference")
};

export default {
  projects: [
    {
      ...commonConfig,
      testMatch: [
        "<rootDir>/test/preference.acceptance.spec.ts",
        "<rootDir>/test/activity.resource.spec.ts"
      ]
    },
    {
      ...commonConfig,
      testMatch: [
        "<rootDir>/test/services/preference.service.spec.ts",
        "<rootDir>/test/preference.integration.spec.ts"
      ],
      setupFilesAfterEnv: [path.join(workspaceRoot, "jest.flaky.setup.js")]
    }
  ]
};
