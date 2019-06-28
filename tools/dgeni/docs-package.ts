import { Package } from 'dgeni';
import { TypeFormatFlags } from 'dgeni-packages/node_modules/typescript';
import { Host } from 'dgeni-packages/typescript/services/ts-host/host';
import { ControllerProcessor } from './processors/controller';
import { ModuleProcessor } from './processors/module';

const jsdocPackage = require('dgeni-packages/jsdoc');
const nunjucksPackage = require('dgeni-packages/nunjucks');
const typescriptPackage = require('dgeni-packages/typescript');


export const apiDocsPackage = new Package('api-docs', [
  jsdocPackage,
  nunjucksPackage,
  typescriptPackage,
]);

apiDocsPackage.processor(new ModuleProcessor());
apiDocsPackage.processor(new ControllerProcessor());


apiDocsPackage.config(function (log: any) {
  return log.level = 'warning';
});

apiDocsPackage.config(function (readFilesProcessor: any) {
  readFilesProcessor.$enabled = false;
});

apiDocsPackage.config(function (computePathsProcessor: any) {
  computePathsProcessor.pathTemplates = [{
    docTypes: ['module', 'controller'],
    pathTemplate: '${name}',
    outputPathTemplate: '${name}.json',
  }];
});

// Configure custom JsDoc tags.
apiDocsPackage.config(function (parseTagsProcessor: any) {
  parseTagsProcessor.tagDefinitions = parseTagsProcessor.tagDefinitions.concat([
    { name: 'docs-private' },
    { name: 'docs-public' },
    { name: 'breaking-change' },
  ]);
});

apiDocsPackage.config(function (tsHost: Host) {
  tsHost.concatMultipleLeadingComments = false;
  tsHost.typeFormatFlags = TypeFormatFlags.NoTruncation;
});

// Configure processor for finding nunjucks templates.
apiDocsPackage.config(function (templateFinder: any, templateEngine: any) {
  // Standard patterns for matching docs to templates
  templateFinder.templatePatterns = [
    '${ doc.template }',
    '${ doc.id }.${ doc.docType }.template.html',
    '${ doc.id }.template.html',
    '${ doc.docType }.template.html',
    '${ doc.id }.${ doc.docType }.template.js',
    '${ doc.id }.template.js',
    '${ doc.docType }.template.js',
    '${ doc.id }.${ doc.docType }.template.json',
    '${ doc.id }.template.json',
    '${ doc.docType }.template.json',
    'common.template.html',
    'common.template.json',
  ];

  // Nunjucks and Angular conflict in their template bindings so change Nunjucks
  templateEngine.config.tags = {
    variableStart: '{$',
    variableEnd: '$}',
  };

});