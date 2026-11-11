import {workspaceRoot} from "@nx/devkit";

export default {
  projects: [
    {
      preset: "../../../../jest.preset.js",
      testMatch: [
        "<rootDir>/test/authorization.spec.ts",
        "<rootDir>/test/service.spec.ts",
        "<rootDir>/test/log.controller.spec.ts",
        "<rootDir>/test/log-options.builder.spec.ts"
      ]
    },
    {
      preset: "../../../../jest.preset.js",
      testMatch: ["<rootDir>/test/realtime.spec.ts", "<rootDir>/test/realtime.postgresql.spec.ts"],
      setupFilesAfterEnv: [`${workspaceRoot}/jest.flaky.setup.js`]
    }
  ]
};
