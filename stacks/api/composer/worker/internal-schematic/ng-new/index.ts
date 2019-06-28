import {
  apply,
  applyTemplates,
  chain,
  externalSchematic,
  MergeStrategy,
  mergeWith,
  Rule,
  SchematicsException,
  url
} from "@angular-devkit/schematics";
import {
  addPackageJsonDependency,
  getPackageJsonDependency,
  NodeDependencyType
} from "../utils/dependencies";

export default function(options: any): Rule {
  const schematicOptions = {
    name: options.name,
    style: "css",
    prefix: "app",
    directory: "/",
    routing: true,
    minimal: true,
    enableIvy: true,
    inlineTemplate: true,
    inlineStyle: true,
    skipGit: true
  };

  return chain([
    externalSchematic("@schematics/angular", "ng-new", schematicOptions),
    mergeWith(
      apply(url("./files"), [
        applyTemplates({
          serverUrl: options.serverUrl,
          frameAnchestor: options.frameAnchestor
        })
      ]),
      MergeStrategy.Overwrite
    ),
    (tree, context) => {
      const devkitVersion = getPackageJsonDependency(tree, "@angular-devkit/build-angular");
      if (!devkitVersion) {
        throw new SchematicsException("Cannot find @angular-devkit/build-angular in package.json");
      }
      addPackageJsonDependency(tree, {
        type: NodeDependencyType.Default,
        overwrite: true,
        name: "@angular/pwa",
        version: devkitVersion.version
      });
      addPackageJsonDependency(tree, {
        type: NodeDependencyType.Default,
        overwrite: true,
        name: "@ccollections/core",
        version: "latest"
      });
      addPackageJsonDependency(tree, {
        type: NodeDependencyType.Default,
        overwrite: true,
        name: "@ccollections/prevalent",
        version: "latest"
      });
      return tree;
    }
  ]);
}
