import {Dgeni, Package} from "dgeni";
import {TypeFormatFlags} from "dgeni-packages/node_modules/typescript";
import {ReadTypeScriptModules} from "dgeni-packages/typescript/processors/readTypeScriptModules";
import {Host} from "dgeni-packages/typescript/services/ts-host/host";
import {TsParser} from "dgeni-packages/typescript/services/TsParser";
import {readFileSync} from "fs";
import {join, relative} from "path";
import {ControllerProcessor} from "./processors/controller";
import {FilterProcessor} from "./processors/filter";

const jsdocPackage = require("dgeni-packages/jsdoc");
const nunjucksPackage = require("dgeni-packages/nunjucks");
const typescriptPackage = require("dgeni-packages/typescript");

export const defaultPackage = new Package("default", [
  jsdocPackage,
  nunjucksPackage,
  typescriptPackage
]);

defaultPackage.processor(new FilterProcessor());
defaultPackage.processor(new ControllerProcessor());

defaultPackage.config(function(readFilesProcessor: any) {
  readFilesProcessor.$enabled = false;
});

defaultPackage.config(function(readTypeScriptModules: ReadTypeScriptModules) {
  readTypeScriptModules.hidePrivateMembers = true;
});

defaultPackage.config(function(computePathsProcessor: any) {
  computePathsProcessor.pathTemplates = [
    {
      docTypes: ["module", "class", "interface", "controller"],
      pathTemplate: "${originalModule}",
      outputPathTemplate: "${originalModule}.html"
    }
  ];
});

defaultPackage.config(function(tsHost: Host) {
  tsHost.concatMultipleLeadingComments = false;
  tsHost.typeFormatFlags = TypeFormatFlags.NoTruncation;
});

defaultPackage.config(function(templateFinder: any, templateEngine: any) {
  templateFinder.templatePatterns = ["${ doc.docType }.template.html", "base.template.html"];
  templateEngine.config.tags = {
    variableStart: "{$",
    variableEnd: "$}"
  };
});

defaultPackage.config(function(log: any) {
  log.level = "warn";
});

function getBazelActionArguments() {
  const args = process.argv.slice(2);

  // If Bazel uses a parameter file, we've specified that it passes the file in the following
  // format: "arg0 arg1 --param-file={path_to_param_file}"
  if (args[0].startsWith("--param-file=")) {
    return readFileSync(args[0].split("=")[1], "utf8")
      .trim()
      .split("\n");
  }

  return args;
}

if (require.main === module) {
  const [
    docLabelDirectory, // Relative to process.cwd()
    docOutputDirectory, // Relative to process.cwd()
    sourceFiles,
    mappings,
    binDir
  ] = getBazelActionArguments();

  const cwd = process.cwd();
  const absoluteSourcePath = join(cwd, docLabelDirectory);
  const absoluteOutputPath = join(cwd, docOutputDirectory);

  // console.warn(`Current directory is ${cwd}`);
  // console.warn(`Source path is ${absoluteSourcePath}`);
  // console.warn(`Output path is ${absoluteOutputPath}`);

  defaultPackage.config(function(
    readTypeScriptModules: ReadTypeScriptModules,
    tsParser: TsParser,
    templateFinder: any,
    writeFilesProcessor: any,
    readFilesProcessor: any
  ) {
    writeFilesProcessor;
    readFilesProcessor.basePath = absoluteSourcePath;

    readTypeScriptModules.basePath = absoluteSourcePath;
    tsParser.options.baseUrl = absoluteSourcePath;

    sourceFiles.split(",").forEach(file => {
      readTypeScriptModules.sourceFiles.push(file);
    });

    tsParser.options.paths = {};

    tsParser.options.paths!["*"] = [
      relative(absoluteSourcePath, join(cwd, "external/npm/node_modules/@types/*")),
      relative(absoluteSourcePath, join(cwd, "external/npm/node_modules/*"))
    ];

    for (const [moduleName, modulePath] of Object.entries<string>(JSON.parse(mappings))) {
      tsParser.options.paths![moduleName] = [join(cwd, binDir, modulePath)];
    }

    templateFinder.templateFolders = [join(cwd, "tools/dgeni/templates/")];
    writeFilesProcessor.outputFolder = absoluteOutputPath;
  });

  new Dgeni([defaultPackage]).generate().catch((e: any) => {
    console.error(e);
    process.exit(1);
  });
}
