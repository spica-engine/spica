import {DocCollection, Processor} from "dgeni";
import * as fs from "fs";
import * as path from "path";

function copyRecursiveSync(src: string, dest: string) {
  if (fs.existsSync(src) && fs.statSync(src).isDirectory()) {
    fs.mkdirSync(dest, {recursive: true});
    const files = fs.readdirSync(src);
    for (const file of files) {
      copyRecursiveSync(path.join(src, file), path.join(dest, file));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
};


export class CopyDataProcessor implements Processor {
  name = "copydata-processor";
  $runBefore = ["rendering-docs"];

  constructor(private outputDir: string, private basePath: string, private data: any[]) {}

  $process(_: DocCollection) {
    for (const doc of this.data) {
      fs.mkdirSync(`${this.outputDir}/${doc.name}`, {recursive: true});
      const sourcePath = path.join(this.basePath, doc.output_path);
      const outputPath = path.join(this.outputDir, doc.name);
      copyRecursiveSync(sourcePath, outputPath);
    }
  }
}
