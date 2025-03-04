import {Compilation} from "@spica-server/function/compiler";
import fs from "fs";
import os from "os";
import path from "path";
import ts from "typescript";
import {parentPort} from "worker_threads";

const ROOT_TSCONFIG_PATH = path.join(os.tmpdir(), "_tsconfig.json");

let diagnosticMap = new WeakMap<ts.EmitAndSemanticDiagnosticsBuilderProgram, ts.Diagnostic[]>();
let builder: ts.SolutionBuilder<ts.EmitAndSemanticDiagnosticsBuilderProgram>;
let host: ts.SolutionBuilderHost<ts.EmitAndSemanticDiagnosticsBuilderProgram>;
const astCache = new Map<string, ts.SourceFile>();
const watchers = new Map<string, fs.FSWatcher>();

function initializeRootTsConfig() {
  updateRootTsConfig({
    compilerOptions: {
      skipDefaultLibCheck: true,
      noEmit: true
    },
    files: [],
    references: []
  });
}

function updateRootTsConfig(config: object) {
  fs.writeFileSync(ROOT_TSCONFIG_PATH, JSON.stringify(config));
}

function readRootTsConfig(): object {
  return JSON.parse(fs.readFileSync(ROOT_TSCONFIG_PATH).toString());
}

function createEmitAndSemanticDiagnosticsBuilderProgram(
  rootNames: readonly string[] | undefined,
  options: ts.CompilerOptions | undefined,
  compilerHost?: ts.CompilerHost,
  oldProgram?: ts.EmitAndSemanticDiagnosticsBuilderProgram,
  configFileParsingDiagnostics?: readonly ts.Diagnostic[],
  projectReferences?: readonly ts.ProjectReference[]
) {
  const originalGetSourceFile = compilerHost.getSourceFile;

  compilerHost.getSourceFile = (
    fileName: string,
    languageVersion: ts.ScriptTarget,
    onError?: (message: string) => void,
    shouldCreateNewSourceFile?: boolean
  ) => {
    const sourceFile = astCache.has(fileName)
      ? astCache.get(fileName)
      : originalGetSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);

    if (!astCache.has(fileName)) {
      astCache.set(fileName, sourceFile);
    }

    if (!watchers.has(fileName) && fileName.indexOf(compilerHost.getDefaultLibLocation()) == -1) {
      const watcher = fs.watch(fileName, {persistent: false});
      watcher.on("change", eventType => {
        if (eventType == "change") {
          astCache.delete(fileName);
        }
      });
      watchers.set(fileName, watcher);
    }
    return sourceFile;
  };

  const program = ts.createEmitAndSemanticDiagnosticsBuilderProgram(
    rootNames,
    options,
    compilerHost,
    oldProgram,
    configFileParsingDiagnostics,
    projectReferences
  );

  diagnosticMap.set(program, []);

  host.reportDiagnostic = diagnostic => {
    diagnosticMap.get(program).push(diagnostic);
  };

  return program;
}

function build(compilation: Compilation) {
  const referencedProject = `${compilation.cwd.replace(/\//g, "_")}_tsconfig.json`;

  astCache.delete(path.join(compilation.cwd, compilation.entrypoint));

  const rootTsConfig: any = readRootTsConfig();

  const refPath = `./${referencedProject}`;

  if (rootTsConfig.references.findIndex(ref => ref.path == refPath) == -1) {
    const options = {
      moduleResolution: "node",
      module: "ES2022",
      target: "ES2022",
      typeRoots: [path.join(compilation.cwd, "node_modules", "@types")],
      sourceMap: true,
      alwaysStrict: true,
      preserveSymlinks: true,
      tsBuildInfoFile: path.join(compilation.cwd, ".build", ".tsbuildinfo"),
      baseUrl: compilation.cwd,
      rootDir: compilation.cwd,
      outDir: path.join(compilation.cwd, ".build")
    };

    fs.writeFileSync(
      path.join(os.tmpdir(), referencedProject),
      JSON.stringify({
        compilerOptions: options,
        files: [path.join(compilation.cwd, compilation.entrypoint)],
        exclude: ["**/.build/**"]
      })
    );

    rootTsConfig.references.push({path: refPath});
    updateRootTsConfig(rootTsConfig);
  }

  builder = ts.createSolutionBuilder(host, [ROOT_TSCONFIG_PATH], {});

  builder.build();
}

function renameJsToMjs(baseUrl: string) {
  const buildFolder = path.join(baseUrl, ".build");
  const filePath = path.join(buildFolder, "index.mjs");

  fs.renameSync(path.join(buildFolder, "index.js"), filePath);
  fs.renameSync(path.join(buildFolder, "index.js.map"), path.join(buildFolder, "index.mjs.map"));

  let content = fs.readFileSync(filePath, "utf8");
  content = content.replace(/(\/\/# sourceMappingURL=).*\.map$/, "$1index.mjs.map");
  fs.writeFileSync(filePath, content);
}

function postCompilation(baseUrl: string, diagnostics: ts.Diagnostic[]) {
  renameJsToMjs(baseUrl);

  parentPort.postMessage({
    baseUrl: baseUrl,
    diagnostics: diagnostics
      .filter(d => d.file)
      .map((diagnostic: ts.Diagnostic) => {
        const start = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start);
        const end = ts.getLineAndCharacterOfPosition(
          diagnostic.file,
          diagnostic.start + diagnostic.length
        );
        return {
          code: diagnostic.code,
          category: diagnostic.category,
          text: ts.flattenDiagnosticMessageText(diagnostic.messageText, ts.sys.newLine),
          start: {
            line: start.line + 1,
            column: start.character + 1
          },
          end: {
            line: end.line + 1,
            column: end.character + 1
          }
        };
      })
  });
}

function handleMessage(message: any) {
  if (message == "quit") {
    cleanUp();
    process.exit(0);
  } else {
    build(message);
  }
}

function cleanUp() {
  parentPort.off("message", handleMessage);
  builder = undefined;
}

function main() {
  host = ts.createSolutionBuilderHost(
    {
      ...ts.sys,
      clearScreen: () => {},
      write: () => {}
    },
    createEmitAndSemanticDiagnosticsBuilderProgram
  );

  host.reportSolutionBuilderStatus = () => {};

  host.afterProgramEmitAndDiagnostics = program => {
    postCompilation(program.getCompilerOptions().baseUrl, diagnosticMap.get(program));
    diagnosticMap.delete(program);
    host.reportDiagnostic = () => {};
  };

  initializeRootTsConfig();

  parentPort.on("message", handleMessage);
}

main();
