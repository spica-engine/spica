import {workspaceRoot} from "@nx/devkit";

export default {
  projects: [
    {
      preset: "../../../../../jest.preset.js",
      testMatch: ["<rootDir>/schema.spec.ts", "<rootDir>/guard.spec.ts"]
    },
    {
      preset: "../../../../../jest.preset.js",
      testMatch: ["<rootDir>/graphql.spec.ts"],
      setupFilesAfterEnv: [`${workspaceRoot}/jest.flaky.setup.js`]
    }
  ]
};
