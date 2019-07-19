import {DocCollection, Processor} from "dgeni";
import * as fs from "fs";
import * as path from "path";


export class CopyDataProcessor implements Processor {
  name = "copydata-processor";
  $runBefore = ["rendering-docs"];

  constructor(private outputDir: string, private basePath: string, private data: any[]) {}

  $process(_: DocCollection) {
    for (const doc of this.data) {
      for (const docfile of doc.docs) {
        const oldDocfilePath = path.join(this.basePath, docfile);
        const newDocFilePath = path.join(
          this.outputDir,
          doc.name,
          docfile.replace(doc.path, "").replace(/^\/?(.*?)/, "$1")
        );
        oldDocfilePath;
        newDocFilePath;
        fs.copyFileSync(oldDocfilePath, newDocFilePath);
      }
    }
  }
}
