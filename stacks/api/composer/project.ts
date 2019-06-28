import {normalize, Path} from "@angular-devkit/core";
import {Injectable} from "@nestjs/common";
import {promises} from "fs";
import * as path from "path";
import {ComposerOptions, ProjectOptions} from "./interface";
import {Schematic} from "./worker/schematic";

@Injectable()
export class Project {
  root: Path;
  schematic: Schematic;

  constructor(public readonly options: ComposerOptions) {
    this.root = normalize(path.resolve(options.path, "composer"));
    this.schematic = new Schematic(this.root, {
      packageManager: "npm",
      version: this.options.version
    });
  }

  initialized() {
    return promises.access(this.root);
  }

  initialize(options: ProjectOptions): Promise<any> {
    return this.schematic._workflow
      .execute({
        allowPrivate: true,
        collection: "@internal/schematics",
        schematic: "ng-new",
        options: {
          name: options.name,
          colors: options.colors,
          font: options.font,
          serverUrl: this.options.serverUrl
        }
      })
      .toPromise()
      .then(() => this.schematic.addWorkspaceDefaults())
      .then(() =>
        this.schematic._workflow
          .execute({
            allowPrivate: true,
            collection: "@angular/pwa",
            schematic: "ng-add",
            options: {}
          })
          .toPromise()
      );
  }
}
