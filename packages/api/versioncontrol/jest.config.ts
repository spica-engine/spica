import {workspaceRoot} from "@nx/devkit";

export default {
  projects: [
    {
      preset: "../../../jest.preset.js",
      displayName: "unit",
      testMatch: ["<rootDir>/test/**/controller.spec.ts","<rootDir>/test/**/versionmanager.spec.ts","<rootDir>/test/**/config.service.spec.ts"],
    },
    {
      preset: "../../../jest.preset.js",
      displayName: "e2e",
      testMatch: ["<rootDir>/test/**/e2e.spec.ts"],
      setupFilesAfterEnv: [`${workspaceRoot}/jest.flaky.setup.js`],
    },
  ],
};
