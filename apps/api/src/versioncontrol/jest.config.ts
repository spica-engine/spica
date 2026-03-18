const path = require("path");
const {workspaceRoot} = require("@nx/devkit");

const commonConfig = {
  preset: "../../../../jest.preset.js",
  testEnvironment: "node",
  coverageDirectory: path.join(workspaceRoot, "coverage/apps/api/versioncontrol")
};

export default {
  projects: [
    // Unit and integration tests (no Docker / MongoDB replica-set required).
    // These run quickly and cover the controller and version-manager in isolation.
    {
      ...commonConfig,
      displayName: "unit",
      testMatch: [
        "<rootDir>/test/**/controller.spec.ts",
        "<rootDir>/test/**/versionmanager.spec.ts",
        "<rootDir>/test/**/config.service.spec.ts"
      ]
    },
    // End-to-end tests that spin up the full NestJS application with a real
    // MongoDB replica set. The suite uses a shared beforeAll so the container
    // is started only once for all e2e scenarios.
    {
      ...commonConfig,
      displayName: "e2e",
      testMatch: ["<rootDir>/test/**/e2e.spec.ts"],
      setupFilesAfterEnv: [path.join(workspaceRoot, "jest.flaky.setup.js")]
    }
  ]
};
