const nxPreset = require("@nx/jest/preset").default;
const path = require("path");

module.exports = {
  ...nxPreset,
  setupFilesAfterEnv: [path.join(__dirname, "jest.setup.js")]
};
