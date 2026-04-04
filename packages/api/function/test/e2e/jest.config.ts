import {workspaceRoot} from "@nx/devkit";

export default {
  projects: [
    {
      preset: "../../../../../jest.preset.js",
      testMatch: ["<rootDir>/*.spec.ts"],
      setupFilesAfterEnv: [`${workspaceRoot}/jest.flaky.setup.js`],
    },
  ],
};
