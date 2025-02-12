import fs from "fs";
import path from "path";

const targetDir = "dist/apps/cli/bin";

fs.mkdir(targetDir, {}, () => {
  const sourceFile = "apps/cli/bin/spica";
  const targetFile = path.join(targetDir, "spica");

  fs.copyFileSync(sourceFile, targetFile);
});
