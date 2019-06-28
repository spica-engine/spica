import {Path} from "@angular-devkit/core";
import * as path from "path";
import * as ts from "typescript";
import {Source, SourceContext} from "../interface";
import {findAll} from "./helper";

export function source(sourcePath: string): Source<ts.SourceFile> {
  return (context: SourceContext) => {
    const absolutePath = path.join(context.root, sourcePath);
    context.program = ts.createProgram({
      host: context.engine.compilerHost,
      options: context.engine.compilerOptions,
      rootNames: [absolutePath],
      oldProgram: context.program
    });
    context.source = context.program.getSourceFile(absolutePath);

    context.import = {
      has: (moduleSpecifier: string) => {
        const importStatement = findAll(context.source, ts.isImportDeclaration).find(
          i =>
            ts.isStringLiteral(i.moduleSpecifier) &&
            i.moduleSpecifier.text === moduleSpecifier &&
            ts.isNamespaceImport(i.importClause.namedBindings)
        );
        return (
          importStatement && (<ts.NamespaceImport>importStatement.importClause.namedBindings).name
        );
      },
      add: (moduleSpecifier: string) => {
        const identifier = ts.createUniqueName("i");
        const importDec = ts.createImportDeclaration(
          undefined,
          undefined,
          ts.createImportClause(undefined, ts.createNamespaceImport(identifier)),
          ts.createLiteral(moduleSpecifier)
        );
        context.transforms.push(context => {
          return sf => {
            return ts.updateSourceFileNode(
              sf,
              [importDec, ...sf.statements],
              sf.isDeclarationFile,
              sf.referencedFiles,
              sf.typeReferenceDirectives,
              sf.hasNoDefaultLib,
              sf.libReferenceDirectives
            );
          };
        });
        return identifier;
      },
      ensure: (moduleSpecifier: string) => {
        return context.import.has(moduleSpecifier) || context.import.add(moduleSpecifier);
      },
      getModule: (namespaceIdentifier: string) => {
        const importStatement = findAll(context.source, ts.isImportDeclaration).find(
          i =>
            ts.isNamespaceImport(i.importClause.namedBindings) &&
            i.importClause.namedBindings.name.escapedText == namespaceIdentifier
        );
        return (
          importStatement &&
          ts.isStringLiteral(importStatement.moduleSpecifier) &&
          importStatement.moduleSpecifier.text
        );
      },
      remove: (moduleSpecifier: string) => {}
    };

    return context.source;
  };
}

export function empty(content?: string): Source<ts.SourceFile> {
  return ctx => (ctx.source = ts.createSourceFile("", content, ts.ScriptTarget.ES2015));
}

export function writeSource(path: string, printOnly?: boolean) {
  return (node, context) => {
    let transformed = ts.transform(context.source, context.transforms).transformed[0];
    if (context.after) {
      transformed = ts.transform(transformed, [context.after]).transformed[0];
    }
    const printedText = ts
      .createPrinter({
        newLine: ts.NewLineKind.LineFeed,
        removeComments: false
      })
      .printFile(transformed);

    if (!printOnly) {
      context.host.write(path as Path, Buffer.from(printedText)).toPromise();
    } else {
      console.log(printedText);
    }

    return node;
  };
}
