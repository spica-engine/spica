export default {
  preset: "../../../jest.preset.js",
  setupFilesAfterEnv: ["<rootDir>/../../../jest.setup.js", "<rootDir>/test/support/bind-ids.ts"],
  testMatch: ["<rootDir>/test/**/*.spec.ts"]
};
