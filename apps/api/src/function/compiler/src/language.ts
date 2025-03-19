import {Compilation} from "./compilation";
import fs from "fs";
import path from "path";

export abstract class Language {
  abstract description: Description;
  abstract compile(compilation: Compilation): Promise<void>;
  abstract kill(): Promise<void>;
  protected async prepare(compilation: Compilation): Promise<string> {
    return fs.promises.mkdir(path.join(compilation.cwd, compilation.outDir), {recursive: true});
  }
}

export interface Description {
  name: string;
  title: string;
  entrypoints: {
    build: string;
    runtime: string;
  };
}
