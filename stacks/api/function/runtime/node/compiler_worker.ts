import {Compilation} from "@spica-server/function/runtime";
import * as fs from "fs";
import * as path from "path";
import * as ts from "typescript";
import {parentPort} from "worker_threads";

const ROOT_TSCONFIG_PATH = "/tmp/_tsconfig.json";

function initializeRootTsConfig() {
  updateRootTsConfig({
    exclude: ["*"],
    references: []
  });
}

function updateRootTsConfig(config: object) {
  fs.writeFileSync(ROOT_TSCONFIG_PATH, JSON.stringify(config));
}

function readRootTsConfig(): object {
  return require(ROOT_TSCONFIG_PATH);
}

const host = ts.createSolutionBuilderWithWatchHost({
  ...ts.sys,
  clearScreen: () => {},
  write: () => {}
});

let diagnostics: ts.Diagnostic[] = [];

host.reportDiagnostic = diagnostic => {
  diagnostics.push(diagnostic);
};

host.reportSolutionBuilderStatus = () => {};

host.afterProgramEmitAndDiagnostics = program => {
  parentPort.postMessage({
    baseUrl: program.getCompilerOptions().baseUrl,
    diagnostics: diagnostics.map((diagnostic: ts.Diagnostic) => {
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
  const options = {
    moduleResolution: "node",
    module: "commonjs",
    target: "ES2020",
    sourceMap: true,
    skipDefaultLibCheck: true,
    alwaysStrict: true,
    preserveSymlinks: true,
    composite: true,
    tsBuildInfoFile: path.join(compilation.cwd, ".build", ".tsbuildinfo"),
    baseUrl: compilation.cwd,
    rootDir: compilation.cwd,
    outDir: path.join(compilation.cwd, ".build")
  };

  const referencedProject = `${compilation.cwd.replace(/\//g, "_")}_tsconfig.json`;

  fs.writeFileSync(
    path.join("/tmp", referencedProject),
    JSON.stringify({
      compilerOptions: options,
      files: [path.join(compilation.cwd, compilation.entrypoint)]
    })
  );

  const rootTsConfig: any = readRootTsConfig();

  const refPath = `./${referencedProject}`;

  if (rootTsConfig.references.findIndex(ref => ref.path == refPath) == -1) {
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
