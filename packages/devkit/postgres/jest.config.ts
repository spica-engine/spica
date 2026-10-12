export default {
  projects: [
    {
      preset: "../../../jest.preset.js",
      testMatch: ["<rootDir>/test/*.spec.ts"],
      modulePathIgnorePatterns: ["<rootDir>/dist/"]
    }
  ]
};
