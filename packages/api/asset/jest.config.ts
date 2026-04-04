import {workspaceRoot} from "@nx/devkit";

export default {
  projects: [
    {
      preset: "../../../jest.preset.js",
      testMatch: ["<rootDir>/test/e2e.spec.ts","<rootDir>/test/helpers.spec.ts"],
    },
    {
      preset: "../../../jest.preset.js",
      testMatch: ["<rootDir>/test/*.e2e.spec.ts"],
      setupFilesAfterEnv: [`${workspaceRoot}/jest.flaky.setup.js`],
    },
  ],
};
