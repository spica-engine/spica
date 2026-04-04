import {workspaceRoot} from "@nx/devkit";

export default {
  projects: [
    {
      preset: "../../../../jest.preset.js",
      testMatch: ["<rootDir>/test/history.service.spec.ts","<rootDir>/test/path.spec.ts"],
    },
    {
      preset: "../../../../jest.preset.js",
      testMatch: ["<rootDir>/test/history.controller.spec.ts"],
      setupFilesAfterEnv: [`${workspaceRoot}/jest.flaky.setup.js`],
    },
  ],
};
