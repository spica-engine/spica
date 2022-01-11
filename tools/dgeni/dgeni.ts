import { Dgeni, Package } from "dgeni";
import { ReadTypeScriptModules } from "dgeni-packages/typescript/processors/readTypeScriptModules";
import { Host } from "dgeni-packages/typescript/services/ts-host/host";
import { TsParser } from "dgeni-packages/typescript/services/TsParser";
import { join, relative } from "path";
import { TypeFormatFlags } from "typescript";
import { AcceptsTag, BodySchemaTag, BodyTag, ControllerProcessor } from "./processors/controller";
import { CopyDataProcessor } from "./processors/copydata";
import { FilterProcessor } from "./processors/filter";
import { ListProcessor } from "./processors/list";
import { SymbolFilterProcessor } from "./processors/symbol-filter";
import { ReadMarkdownFiles, remarkPackage } from "./remark";

import jsdocPackage = require("dgeni-packages/jsdoc");
import nunjucksPackage = require("dgeni-packages/nunjucks");
import typescriptPackage = require("dgeni-packages/typescript");

export const defaultPackage = new Package("default", [
  jsdocPackage,
  nunjucksPackage,
  typescriptPackage,
  remarkPackage
]);

defaultPackage.processor(new FilterProcessor());
defaultPackage.processor(new ControllerProcessor());

defaultPackage.config(function(
  readFilesProcessor: any,
  tsHost: Host,
  readTypeScriptModules: ReadTypeScriptModules,
  computePathsProcessor: any,
  templateFinder: any,
  templateEngine: any,
  log: any,
  parseTagsProcessor: any,
  getInjectables: any
) {

  parseTagsProcessor.tagDefinitions = parseTagsProcessor.tagDefinitions.concat(
    getInjectables([BodyTag, BodySchemaTag, AcceptsTag]));

  readFilesProcessor.$enabled = false;
  readTypeScriptModules.hidePrivateMembers = true;

  tsHost.concatMultipleLeadingComments = false;
  tsHost.typeFormatFlags = TypeFormatFlags.NoTruncation;

  computePathsProcessor.pathTemplates = [
    {
      docTypes: ["module", "class", "interface", "controller"],
      pathTemplate: "${name}",
      outputPathTemplate: "${name}.html"
    },
    {
      docTypes: ["markdown"],
      pathTemplate: "${originalModule}",
      outputPathTemplate: "${originalModule}.html"
    },
    {
      docTypes: ["doc-list"],
      pathTemplate: "${docType}",
      outputPathTemplate: "${docType}.json"
    }
  ];
  templateFinder.templatePatterns = [
    "${ doc.docType }.template.html",
    "${ doc.docType }.template.json",
    "base.template.html"
  ];
  templateEngine.config.tags = {
    variableStart: "{$",
    variableEnd: "$}"
  };

  log.level = "warn";
});


const [
  docName,
  docOutputDirectory, // Relative to process.cwd()
  sourceFiles,
  expectedSymbols,
  mappings,
  binDir,
  dataRaw
] = process.argv.slice(2);

const cwd = process.cwd();
const absoluteSourcePath = cwd;
const absoluteOutputPath = join(cwd, docOutputDirectory);

defaultPackage.processor(new SymbolFilterProcessor(expectedSymbols.split(",")));
defaultPackage.processor(new ListProcessor(docName, join(cwd, binDir), JSON.parse(dataRaw).data));
defaultPackage.processor(new CopyDataProcessor(absoluteOutputPath, join(cwd, binDir), JSON.parse(dataRaw).data));

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


  readTypeScriptModules.ignoreExportsMatching = [/$_/];

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
