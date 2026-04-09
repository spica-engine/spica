import {workspaceRoot} from "@nx/devkit";

export default {
  projects: [
    {
      preset: "../../../jest.preset.js",
      displayName: "unit",
      testMatch: [
        "<rootDir>/test/**/controller.spec.ts",
        "<rootDir>/test/**/versionmanager.spec.ts",
        "<rootDir>/test/**/config.service.spec.ts"
      ]
    }
  ]
};
