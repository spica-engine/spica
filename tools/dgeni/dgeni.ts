import {Dgeni, Package} from "dgeni";
import {TypeFormatFlags} from "dgeni-packages/node_modules/typescript";
import {ReadTypeScriptModules} from "dgeni-packages/typescript/processors/readTypeScriptModules";
import {Host} from "dgeni-packages/typescript/services/ts-host/host";
import {TsParser} from "dgeni-packages/typescript/services/TsParser";
import {readFileSync} from "fs";
import {join, relative} from "path";
import {ControllerProcessor} from "./processors/controller";
import {FilterProcessor} from "./processors/filter";
import {remarkPackage, ReadMarkdownFiles} from "./remark";
import {ListProcessor} from "./processors/list";

const jsdocPackage = require("dgeni-packages/jsdoc");
const nunjucksPackage = require("dgeni-packages/nunjucks");
const typescriptPackage = require("dgeni-packages/typescript");

export const defaultPackage = new Package("default", [
  jsdocPackage,
  nunjucksPackage,
  typescriptPackage,
  remarkPackage
]);

defaultPackage.processor(new FilterProcessor());
defaultPackage.processor(new ControllerProcessor());
defaultPackage.processor(new ListProcessor());

defaultPackage.config(function(readFilesProcessor: any) {
  readFilesProcessor.$enabled = false;
});

defaultPackage.config(function(readTypeScriptModules: ReadTypeScriptModules) {
  readTypeScriptModules.hidePrivateMembers = true;
});

defaultPackage.config(function(computePathsProcessor: any) {
  computePathsProcessor.pathTemplates = [
    {
      docTypes: ["module", "class", "interface", "controller", "markdown"],
      pathTemplate: "${originalModule}",
      outputPathTemplate: "${originalModule}.html"
    },
    {
      docTypes: ["doc-list"],
      pathTemplate: "${docType}",
      outputPathTemplate: "${docType}.json"
    }
  ];
});

defaultPackage.config(function(tsHost: Host) {
  tsHost.concatMultipleLeadingComments = false;
  tsHost.typeFormatFlags = TypeFormatFlags.NoTruncation;
});

defaultPackage.config(function(templateFinder: any, templateEngine: any) {
  templateFinder.templatePatterns = [
    "${ doc.docType }.template.html",
    "${ doc.docType }.template.json",
    "base.template.html"
  ];
  templateEngine.config.tags = {
    variableStart: "{$",
    variableEnd: "$}"
  };
});

defaultPackage.config(function(log: any) {
  log.level = "warn";
});

if (require.main === module) {
  const [
    docLabelDirectory, // Relative to process.cwd()
    docOutputDirectory, // Relative to process.cwd()
    sourceFiles,
    mappings,
    binDir
  ] = readFileSync(process.argv.slice(2)[0], {encoding: "utf-8"})
    .split("\n")
    .map(s => s.replace(/^'(.*)'$/, "$1"));

  const cwd = process.cwd();
  const absoluteSourcePath = join(cwd, docLabelDirectory);
  const absoluteOutputPath = join(cwd, docOutputDirectory);

  defaultPackage.config(function(
    readTypeScriptModules: ReadTypeScriptModules,
    readMarkdownFiles: ReadMarkdownFiles,
    tsParser: TsParser,
    templateFinder: any,
    writeFilesProcessor: any,
    readFilesProcessor: any
  ) {
    readFilesProcessor.basePath = absoluteSourcePath;
    readMarkdownFiles.basePath = absoluteSourcePath;
    readTypeScriptModules.basePath = absoluteSourcePath;
    tsParser.options.baseUrl = absoluteSourcePath;

    sourceFiles.split(",").forEach(file => {
      if (file.endsWith(".ts")) {
        readTypeScriptModules.sourceFiles.push(file);
      } else {
        readMarkdownFiles.files.push(file);
      }
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
