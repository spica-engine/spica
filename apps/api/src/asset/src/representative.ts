import {ExportMeta} from "@spica/interface";
import {RepresentativeManager} from "@spica/representative";
import * as archiver from "archiver";
import * as fs from "fs";
import * as path from "path";

export class AssetRepManager extends RepresentativeManager {
  constructor(cwd: string) {
    super(cwd);
  }

  cleanExportDirectory() {
    return this.rm();
  }

  putAssetMeta(meta: ExportMeta) {
    meta = JSON.parse(JSON.stringify(meta));
    delete meta.resources;
    return this.write("", "", "asset", meta, "yaml");
  }

  zipAssets(): Promise<string> {
    const fileName = "asset.zip";
    const outputPath = path.join(this.cwd, fileName);
    const archive = archiver("zip", {zlib: {level: 9}});
    const stream = fs.createWriteStream(outputPath);

    return new Promise((resolve, reject) => {
      archive
        .glob("**", {cwd: this.cwd, ignore: fileName})
        .on("error", err => reject(err))
        .pipe(stream);

      stream.on("close", () => resolve(outputPath));
      archive.finalize();
    });
  }
}
