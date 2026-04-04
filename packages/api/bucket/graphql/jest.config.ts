import {workspaceRoot} from "@nx/devkit";

export default {
  projects: [
    {
      preset: "../../../../jest.preset.js",
      testMatch: ["<rootDir>/test/schema.spec.ts"],
    },
    {
      preset: "../../../../jest.preset.js",
      testMatch: ["<rootDir>/test/graphql.spec.ts"],
      setupFilesAfterEnv: [`${workspaceRoot}/jest.flaky.setup.js`],
    },
    {
      preset: "../../../../jest.preset.js",
      testMatch: ["<rootDir>/test/acl-rules.spec.ts"],
      setupFilesAfterEnv: [`${workspaceRoot}/jest.flaky.setup.js`],
    },
  ],
};
