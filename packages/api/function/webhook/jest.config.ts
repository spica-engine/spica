import {workspaceRoot} from "@nx/devkit";

export default {
  projects: [
    {
      preset: "../../../../jest.preset.js",
      testMatch: ["<rootDir>/test/schema.spec.ts", "<rootDir>/test/log.service.spec.ts"],
      moduleNameMapper: {"node-fetch": "<rootDir>/__mocks__/node-fetch.cjs"}
    },
    {
      preset: "../../../../jest.preset.js",
      testMatch: [
        "<rootDir>/test/webhook.service.spec.ts",
        "<rootDir>/test/invoker.spec.ts",
        "<rootDir>/test/webhook.controller.spec.ts",
        "<rootDir>/test/log.controller.spec.ts"
      ],
      moduleNameMapper: {"node-fetch": "<rootDir>/__mocks__/node-fetch.cjs"},
      setupFilesAfterEnv: [`${workspaceRoot}/jest.flaky.setup.js`]
    }
  ]
};
