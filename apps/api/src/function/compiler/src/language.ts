import {Compilation} from "./compilation";
import fs from "fs";
import path from "path";

export abstract class Language {
  abstract description: Description;
  abstract compile(compilation: Compilation): Promise<void>;
  abstract kill(): Promise<void>;
  protected async prepare(compilation: Compilation): Promise<string> {
    return fs.promises.mkdir(path.join(compilation.cwd, ".build"), {recursive: true});
  }
}

export interface Description {
  entrypoint: string;
  extension: string;
  name: string;
  title: string;
}
