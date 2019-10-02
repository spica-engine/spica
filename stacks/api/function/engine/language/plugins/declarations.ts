import * as glob from "fast-glob";
import * as path from "path";
import * as ts from "typescript";
import * as tss from "typescript/lib/tsserverlibrary";

function init(modules: {typescript: typeof tss}) {
  function create(info: tss.server.PluginCreateInfo): tss.LanguageService {
    const projectRoot = info.project.projectService.toPath(info.project.getCurrentDirectory());

    info.project.setCompilerOptions({
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2018,
      skipDefaultLibCheck: true,
      lib: ["es2018"]
    });

    glob
      .sync(["module/*.d.ts", "trigger/*.d.ts"], {
        cwd: path.resolve(__dirname, "..", ".."),
        absolute: true
      })
      .forEach(path => info.project.addMissingFileRoot(path as any));

    info.project.installPackage({fileName: projectRoot, packageName: "@types/node"});
    return info.languageService;
  }

  return {create};
}

export = init;
