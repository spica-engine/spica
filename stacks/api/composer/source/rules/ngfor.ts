import {JSONSchema6Definition} from "json-schema";
import * as ts from "typescript";
import {assertKind} from "../assert";
import {Rule, SourceContext} from "../interface";
import {chain} from "./base";
import {addDirective, addPipe} from "./def";
import {
  evaluateExpression,
  findAll,
  findAncestor,
  findFirst,
  findSlot,
  findStatementIndex,
  getInstructionName,
  getVars,
  valueToExpression
} from "./helper";
import {addConstructorParameter, addInject} from "./inject";
import {addProperty} from "./property";
import {template} from "./template";

export type NgForOfSchema = {
  name: string;
  properties: JSONSchema6Definition;
};

// TODO: Check attributes explicitly.
export function hasNgForOf(expr: ts.CallExpression): boolean {
  const attrArg = expr.arguments[5] as ts.ArrayLiteralExpression;
  return attrArg.elements.length == 4;
}

export interface NgForOfInfo {
  declaration?: ts.CallExpression;
  moduleSpecifier: string;
  importSpecifier: string;
  method: string;
  arguments: any;
}

export interface NgForOfOptions {
  index: string;
  moduleSpecifier: string;
  importSpecifier: string;
  method: string;
  arguments: any;
}

export function ngForOf() {
  return (expr: ts.CallExpression, ctx: SourceContext) => {
    const checker = ctx.program.getTypeChecker();
    const bindingArg = expr.arguments[2];

    // Find the most property access expr
    // Example: i0.ɵbind(i0.ɵpipeBind1(3, 1, ctx.d_data))
    // Will match with ctx.d_data
    const propertyAccess = findAll(bindingArg, ts.isPropertyAccessExpression).pop();

    // Find the declaration of the ctx.d_data in class.
    const propDec = checker.getSymbolAtLocation(propertyAccess)
      .valueDeclaration as ts.PropertyDeclaration;
    const initializer = propDec.initializer as ts.PropertyAccessExpression;

    // Extract qualifier of d_data  from initializer.
    // Will extract `this.bucket`
    const propAccessExpr =
      ts.isPropertyAccessExpression(initializer.expression) && initializer.expression.expression;

    // Find the declaration of this.bucket
    // Will find the parameter declaration on constructor
    const foundSymbol = checker.getSymbolAtLocation(propAccessExpr);
    const referenceParam = foundSymbol.getDeclarations().pop() as ts.ParameterDeclaration;
    assertKind(referenceParam, ts.SyntaxKind.Parameter);

    // Node which contains ix.BucketService
    const type = referenceParam.type as ts.TypeReferenceNode;
    const typeName = type.typeName as ts.QualifiedName;

    const callExpr = findFirst(propDec, ts.isCallExpression);

    return {
      method: (callExpr.expression as ts.PropertyAccessExpression).name.text,
      declaration: callExpr,
      importSpecifier: typeName.right.text,
      moduleSpecifier: ctx.import.getModule((typeName.left as ts.Identifier).text),
      arguments: evaluateExpression(callExpr.arguments[0] as ts.ObjectLiteralExpression)
    };
  };
}

export function addNgForOf(options: NgForOfOptions): Rule<template.Template> {
  return chain((templ, ctx) => {
    const coreIdentifier = ctx.import.ensure("@angular/core");
    const commonIdentifier = ctx.import.ensure("@angular/common");
    const fnName = ts.createUniqueName("template");

    // Remove old instructions properties
    ctx.transforms.push(template.removeInstructionProperties(templ, options.index));
    ctx.transforms.push(template.removeInstruction(templ, options.index));

    const oldInstruction = template.getInstruction(templ, options.index);
    const oldInstructionStatementIndex = findStatementIndex(
      findAncestor(oldInstruction, ts.isExpressionStatement)
    );

    // Create element instruction
    const newTemplateInstruction = ts.createCall(
      ts.createPropertyAccess(coreIdentifier, ts.createIdentifier("ɵtemplate")),
      undefined,
      ts.createNodeArray([
        ts.createNumericLiteral(options.index),
        fnName,
        ts.createNumericLiteral("1"),
        ts.createNumericLiteral("0"),
        ts.createNull(),
        ts.createArrayLiteral([
          ts.createStringLiteral("ngFor"),
          ts.createStringLiteral(""),
          ts.createNumericLiteral("3"),
          ts.createStringLiteral("ngForOf")
        ])
      ])
    );

    ctx.transforms.push(
      template.addInstructionAtIndex(templ, newTemplateInstruction, oldInstructionStatementIndex)
    );

    // Add old instruction to new template
    // Newly created nodes don't have information
    // Add old instruction directly.
    const oldElementName = getInstructionName(oldInstruction);
    const instructionStatement = ts.createExpressionStatement(
      ts.createCall(
        ts.createPropertyAccess(coreIdentifier, "ɵelement"),
        undefined,
        ts.createNodeArray([ts.createNumericLiteral("0"), ts.createStringLiteral(oldElementName)])
      )
    );

    // Add  new template to sourcefile.
    const templateFn = createTemplateFunction(commonIdentifier, coreIdentifier, fnName, [
      instructionStatement
    ]);
    ctx.transforms.push(() => node =>
      ts.updateSourceFileNode(
        node,
        [...node.statements, templateFn],
        node.isDeclarationFile,
        node.referencedFiles,
        node.typeReferenceDirectives,
        node.hasNoDefaultLib,
        node.libReferenceDirectives
      )
    );

    ctx.transforms.push(addPipe(ctx, "AsyncPipe", "@angular/common"));
    ctx.transforms.push(addDirective(ctx, "NgForOf", "@angular/common"));
    ctx.transforms.push(addInject(ctx, options.importSpecifier, options.moduleSpecifier));
    const {identifier, transform} = addConstructorParameter(
      ctx,
      options.importSpecifier,
      options.moduleSpecifier
    );
    ctx.transforms.push(transform);

    const pipeIndex = findSlot(templ.block);
    const slotOffset = pipeIndex + getVars(templ.block);

    // Add pipe to create block.
    ctx.transforms.push(
      template.addInstruction(
        templ,
        ts.createCall(
          ts.createPropertyAccess(coreIdentifier, "ɵpipe"),
          undefined,
          ts.createNodeArray([ts.createLiteral(pipeIndex), ts.createStringLiteral("async")])
        ),
        "after"
      )
    );

    // Add new property to class.
    const initializer = ts.createCall(
      ts.createPropertyAccess(ts.createPropertyAccess(ts.createThis(), identifier), options.method),
      undefined,
      ts.createNodeArray([valueToExpression(options.arguments)])
    );

    const propertyOp = addProperty(undefined, initializer);

    ctx.transforms.push(propertyOp.transform);

    // Add new property to instruction
    const pipeBind = ts.createCall(
      ts.createPropertyAccess(coreIdentifier, "ɵpipeBind1"),
      undefined,
      ts.createNodeArray([
        ts.createLiteral(pipeIndex),
        ts.createLiteral(slotOffset),
        ts.createPropertyAccess(ts.createIdentifier("context"), propertyOp.identifier)
      ])
    );

    ctx.transforms.push(
      template.addInstructionProperty(templ, ctx, options.index, "ngForOf", pipeBind)
    );
  });
}

export function updateNgForOf(args: any): Rule<NgForOfInfo, ts.CallExpression> {
  return ({declaration}) => {
    declaration.arguments = ts.createNodeArray([valueToExpression(args)]);
    return declaration;
  };
}

export function createTemplateFunction(
  commonIdentifier: ts.Identifier,
  coreIdentifier: ts.Identifier,
  fnIdentifier: ts.Identifier,
  createStatements?: ts.Statement[],
  updateStatements?: ts.Statement[]
) {
  const rfParameter = ts.createParameter(
    undefined,
    undefined,
    undefined,
    "rf",
    undefined,
    ts.createTypeReferenceNode(ts.createQualifiedName(coreIdentifier, "ɵRenderFlags"), undefined)
  );

  const ctxParameter = ts.createParameter(
    undefined,
    undefined,
    undefined,
    "context",
    undefined,
    ts.createTypeReferenceNode(
      ts.createQualifiedName(commonIdentifier, "NgForOfContext"),
      ts.createNodeArray([ts.createTypeReferenceNode("any", undefined)])
    )
  );

  const createIfStatement = (rf: string, statements: ts.Statement[]) => {
    return ts.createIf(
      ts.createBinary(
        ts.createIdentifier("rf"),
        ts.SyntaxKind.AmpersandToken,
        ts.createPropertyAccess(ts.createPropertyAccess(coreIdentifier, "ɵRenderFlags"), rf)
      ),
      ts.createBlock(statements, true)
    );
  };

  return ts.createFunctionDeclaration(
    undefined,
    undefined,
    undefined,
    fnIdentifier,
    undefined,
    ts.createNodeArray([rfParameter, ctxParameter]),
    undefined,
    ts.createBlock(
      ts.createNodeArray([
        createIfStatement("Create", createStatements),
        createIfStatement("Update", updateStatements)
      ]),
      true
    )
  );
}
