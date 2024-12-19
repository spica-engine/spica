const fs = require("fs");
const path = require("path");
const os = require("os");

const testTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "jest-"));
process.env.TEST_TMPDIR = testTmpDir;

afterAll(() => {
  if (fs.existsSync(testTmpDir)) {
    fs.rmSync(testTmpDir, {recursive: true, force: true});
  }
});
