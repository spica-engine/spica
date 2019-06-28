import {Path, schema, virtualFs, experimental, normalize} from "@angular-devkit/core";
import {NodeJsSyncHost, resolve, NodeJsAsyncHost} from "@angular-devkit/core/node";
import {NodeWorkflow} from "@angular-devkit/schematics/tools";
import * as path from "path";

export class InternalNodeWorkflow extends NodeWorkflow {
  constructor(
    host: virtualFs.Host,
    options: {
      force?: boolean;
      dryRun?: boolean;
      root?: Path;
      packageManager?: string;
    }
  ) {
    super(host, options);

    const originalResolvePackageJson = this._engineHost["_resolvePackageJson"];
    this._engineHost["_resolvePackageJson"] = (name: string, cwd: string = process.cwd()) => {
      if (name == "@internal/schematics") {
        return path.resolve(__dirname, "internal-schematic");
      }

      try {
        return originalResolvePackageJson(name, cwd);
      } catch (e) {
        return resolve(name, {
          basedir: options.root,
          checkGlobal: true,
          checkLocal: true,
          resolvePackageJson: true
        });
      }
    };
  }
}

export class Schematic {
  public _workflow: NodeWorkflow;
  public _host: virtualFs.ScopedHost<any>;

  constructor(private root: Path, options: BaseSchematicOptions) {
    this._host = new virtualFs.ScopedHost(new NodeJsSyncHost(), root);
    this._workflow = new InternalNodeWorkflow(this._host, {root, ...options});
    this._workflow.registry.addPreTransform(schema.transforms.addUndefinedDefaults);
    this._workflow.registry.addSmartDefaultProvider("ng-cli-version", () => options.version);
  }

  async addWorkspaceDefaults() {
    try {
      const workspace = await new experimental.workspace.Workspace(this.root, new NodeJsAsyncHost())
        .loadWorkspaceFromHost(normalize("angular.json"))
        .toPromise();
      this._workflow.registry.addSmartDefaultProvider("projectName", () =>
        workspace.getDefaultProjectName()
      );
    } catch (e) {
      console.log(e);
    }
  }
}

export interface BaseSchematicOptions {
  force?: boolean;
  dryRun?: boolean;
  packageManager?: string;
  root?: Path;
  version?: string;
}
