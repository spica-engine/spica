import fs from "fs";
import path from "path";
import {Compilation, Description} from "@spica-server/interface/function/compiler";

export abstract class Language {
  abstract description: Description;
  abstract compile(compilation: Compilation): Promise<void>;
  abstract kill(): Promise<void>;
  protected async prepare(compilation: Compilation): Promise<string> {
    return fs.promises.mkdir(path.join(compilation.cwd, compilation.outDir), {recursive: true});
  }
}
