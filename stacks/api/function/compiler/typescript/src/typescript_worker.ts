import {Compilation} from "@spica-server/function/compiler";
import * as fs from "fs";
import * as path from "path";
import * as ts from "typescript";
import {parentPort} from "worker_threads";

const ROOT_TSCONFIG_PATH = "/tmp/_tsconfig.json";

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
  return require(ROOT_TSCONFIG_PATH);
}

const astCache = new Map<string, ts.SourceFile>();
const watchers = new Map<string, void>();
function createEmitAndSemanticDiagnosticsBuilderProgram(
  rootNames: readonly string[] | undefined,
  options: ts.CompilerOptions | undefined,
  host?: ts.CompilerHost,
  oldProgram?: ts.EmitAndSemanticDiagnosticsBuilderProgram,
  configFileParsingDiagnostics?: readonly ts.Diagnostic[],
  projectReferences?: readonly ts.ProjectReference[]
) {
  const originalGetSourceFile = host.getSourceFile;

  host.getSourceFile = (
    fileName: string,
    languageVersion: ts.ScriptTarget,
    onError?: (message: string) => void,
    shouldCreateNewSourceFile?: boolean
  ) => {
    const sourceFile = astCache.has(fileName)
      ? astCache.get(fileName)
      : originalGetSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
    setImmediate(() => {
      if (!astCache.has(fileName)) {
        astCache.set(fileName, sourceFile);
      }
      if (!watchers.has(fileName)) {
        watchers.set(
          fileName,
          fs.watchFile(fileName, {persistent: false}, () => {
            astCache.delete(fileName);
          })
        );
      }
    });
    return sourceFile;
  };

  return ts.createEmitAndSemanticDiagnosticsBuilderProgram(
    rootNames,
    options,
    host,
    oldProgram,
    configFileParsingDiagnostics,
    projectReferences
  );
}

const host = ts.createSolutionBuilderWithWatchHost(
  {
    ...ts.sys,
    clearScreen: () => {},
    write: () => {}
  },
  createEmitAndSemanticDiagnosticsBuilderProgram
);

let diagnostics: ts.Diagnostic[] = [];

host.reportDiagnostic = diagnostic => {
  diagnostics.push(diagnostic);
};

host.reportSolutionBuilderStatus = () => {};

host.afterProgramEmitAndDiagnostics = program => {
  parentPort.postMessage({
    baseUrl: program.getCompilerOptions().baseUrl,
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
  diagnostics = [];
};

let builder: ts.SolutionBuilder<ts.EmitAndSemanticDiagnosticsBuilderProgram>;

function build(compilation: Compilation) {
  const referencedProject = `${compilation.cwd.replace(/\//g, "_")}_tsconfig.json`;

  const rootTsConfig: any = readRootTsConfig();

  const refPath = `./${referencedProject}`;

  if (rootTsConfig.references.findIndex(ref => ref.path == refPath) == -1) {
    const options = {
      moduleResolution: "node",
      module: "commonjs",
      target: "ES2020",
      typeRoots: [path.join(compilation.cwd, "node_modules", "@types")],
      sourceMap: true,
      alwaysStrict: true,
      preserveSymlinks: true,
      composite: true,
      incremental: true,
      tsBuildInfoFile: path.join(compilation.cwd, ".build", ".tsbuildinfo"),
      baseUrl: compilation.cwd,
      rootDir: compilation.cwd,
      outDir: path.join(compilation.cwd, ".build")
    };

    fs.writeFileSync(
      path.join("/tmp", referencedProject),
      JSON.stringify({
        compilerOptions: options,
        files: [path.join(compilation.cwd, compilation.entrypoint)],
        exclude: ["**/.build/**"]
      })
    );

    rootTsConfig.references.push({path: refPath});
    updateRootTsConfig(rootTsConfig);

    builder = ts.createSolutionBuilderWithWatch(host, [ROOT_TSCONFIG_PATH], {
      watch: true,
      incremental: true
    });
    builder.build();
  }
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

initializeRootTsConfig();

parentPort.on("message", handleMessage);
