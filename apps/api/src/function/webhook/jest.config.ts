const path = require("path");
const {workspaceRoot} = require("@nx/devkit");

const commonConfig = {
  preset: "../../../../../jest.preset.js",
  testEnvironment: "node",
  coverageDirectory: path.join(workspaceRoot, "coverage/apps/api/function/webhook")
};

export default {
  projects: [
    {
      ...commonConfig,
      testMatch: ["<rootDir>/test/schema.spec.ts", "<rootDir>/test/log.service.spec.ts"]
    },
    {
      ...commonConfig,
      testMatch: [
        "<rootDir>/test/webhook.service.spec.ts",
        "<rootDir>/test/invoker.spec.ts",
        "<rootDir>/test/webhook.controller.spec.ts",
        "<rootDir>/test/log.controller.spec.ts"
      ],
      setupFilesAfterEnv: [path.join(workspaceRoot, "jest.flaky.setup.js")]
    }
  ]
};
