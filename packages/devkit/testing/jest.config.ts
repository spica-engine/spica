import {workspaceRoot} from "@nx/devkit";

export default {
  projects: [
    {
      preset: "../../../jest.preset.js",
      testMatch: ["<rootDir>/test/*.spec.ts"],
      testPathIgnorePatterns: ["<rootDir>/test/testing.e2e.spec.ts"],
      modulePathIgnorePatterns: ["<rootDir>/dist/", "<rootDir>/test/fixtures/"]
    },
    {
      preset: "../../../jest.preset.js",
      testMatch: ["<rootDir>/test/testing.e2e.spec.ts"],
      setupFilesAfterEnv: [`${workspaceRoot}/jest.flaky.setup.js`],
      modulePathIgnorePatterns: ["<rootDir>/dist/", "<rootDir>/test/fixtures/"]
    }
  ]
};
