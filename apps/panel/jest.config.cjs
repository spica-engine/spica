module.exports = {
  transform: {
    "^.+\\.m?tsx?$": ["ts-jest", {useESM: true, diagnostics: false}]
  },
  extensionsToTreatAsEsm: [".ts", ".tsx"],
  testEnvironment: "node",
  testMatch: ["<rootDir>/src/**/*.spec.ts"]
};
