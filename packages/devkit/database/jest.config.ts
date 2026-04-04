import {workspaceRoot} from "@nx/devkit";

export default {
  projects: [
    {
      preset: "../../../jest.preset.js",
      testMatch: ["<rootDir>/test/*.spec.ts"],
    },
    {
      preset: "../../../jest.preset.js",
      testMatch: ["<rootDir>/test/database.e2e.spec.ts"],
      setupFilesAfterEnv: [`${workspaceRoot}/jest.flaky.setup.js`],
    },
  ],
};
