import {workspaceRoot} from "@nx/devkit";

export default {
  projects: [
    {
      preset: "../../../jest.preset.js",
      testMatch: ["<rootDir>/test/preference.acceptance.spec.ts","<rootDir>/test/activity.resource.spec.ts"],
    },
    {
      preset: "../../../jest.preset.js",
      testMatch: ["<rootDir>/test/services/preference.service.spec.ts","<rootDir>/test/preference.integration.spec.ts"],
      setupFilesAfterEnv: [`${workspaceRoot}/jest.flaky.setup.js`],
    },
  ],
};
