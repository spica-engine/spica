import {workspaceRoot} from "@nx/devkit";

export default {
  projects: [
    {
      preset: "../../../../jest.preset.js",
      testMatch: ["<rootDir>/test/authorization.spec.ts","<rootDir>/test/service.spec.ts"],
    },
    {
      preset: "../../../../jest.preset.js",
      testMatch: ["<rootDir>/test/realtime.spec.ts"],
      setupFilesAfterEnv: [`${workspaceRoot}/jest.flaky.setup.js`],
    },
  ],
};
