import * as ts from "typescript";
import {assertKind} from "../assert";
import {Rule, SourceContext} from "../interface";
import {addDirective} from "./def";
import {
  createPropertyAccessFromString,
  evaluateExpression,
  findAll,
  findAncestor,
  findFirst,
  findMostHighIndex,
  getCalle,
  getFunctionDeclaration,
  getInstructionIndex,
  getInstructionName,
  insertStatement,
  isCreateBlock,
  isFunctionBlock,
  isInstructionCall,
  isPropertyInstructionCall,
  isUpdateBlock,
  valueToExpression,
  collectInstructions,
  findSlot
} from "./helper";

export namespace template {
  export function getInstructionProperty(template: template.Template, index: string, name: string) {
    return getAllPropertyInstructions(template.block).find(
      property => getInstructionIndex(property) == index && getInstructionName(property) == name
    );
  }

  // TODO: Remove pipe instructions if the propert instruction has any
  export function removeInstructionProperties(
    template: template.Template,
    index: string,
    names?: string[]
  ): ts.TransformerFactory<ts.SourceFile> {
    return context => {
      const visitor = (node: ts.Node) => {
        if (
          isInstructionCall(node) &&
          getInstructionIndex(node) == index &&
          findAncestor(node, isFunctionBlock) == template.block
        ) {
          const newAttributes = [];

          const attributes = node.arguments[2] as ts.ArrayLiteralExpression;

          if (!attributes) {
            return node;
          }

          for (let i = 0; i < attributes.elements.length; i += 2) {
            const key = attributes.elements[i];
            const value = attributes.elements[i + 1];

            if (
              (ts.isStringLiteral(key) && (names ? names.indexOf(key.text) != -1 : true)) ||
              (ts.isNumericLiteral(key) &&
                ts.isStringLiteral(value) &&
                (names ? names.indexOf(value.text) != -1 : true))
            ) {
              continue;
            }

            newAttributes.push(key, value);
          }

          if (!attributes || attributes.elements.length == newAttributes.length) {
            return node;
          }

          console.log("Removed attributes", names);

          return ts.updateCall(
            node,
            node.expression,
            node.typeArguments,
            ts.createNodeArray([
              node.arguments[0],
              node.arguments[1],
              ts.updateArrayLiteral(node.arguments[2] as ts.ArrayLiteralExpression, newAttributes)
            ])
          );
        }

        if (
          ts.isExpressionStatement(node) &&
          isPropertyInstructionCall(node.expression) &&
          findAncestor(node, isFunctionBlock) == template.block &&
          getInstructionIndex(node.expression) == index &&
          (names ? names.indexOf(getInstructionName(node.expression)) != -1 : true)
        ) {
          console.log("Removed propertyAssignment", names);
          return ts.createNotEmittedStatement(node);
        }

        return ts.visitEachChild(node, visitor, context);
      };

      return node => ts.visitNode(node, visitor);
    };
  }

  export function addInstructionProperty(
    template: template.Template,
    ctx: SourceContext,
    index: string,
    propName: string,
    init: ts.Expression
  ): ts.TransformerFactory<ts.SourceFile> {
    const coreIdentifier = ctx.import.ensure("@angular/core");
    return context => {
      const visitor = (node: ts.Node) => {
        if (
          isInstructionCall(node) &&
          getInstructionIndex(node) == index &&
          findAncestor(node, isFunctionBlock) == template.block
        ) {
          const attributesArg = node.arguments[2] as ts.ArrayLiteralExpression;

          let oldElements: ts.Expression[] = [
            ts.createNumericLiteral("3"),
            ts.createStringLiteral(propName)
          ];

          if (attributesArg && ts.isArrayLiteralExpression(attributesArg)) {
            oldElements.push(...attributesArg.elements);
          }

          console.log("Added attributes", propName);
          return ts.updateCall(
            node,
            node.expression,
            node.typeArguments,
            ts.createNodeArray([
              node.arguments[0],
              node.arguments[1],
              ts.createArrayLiteral(ts.createNodeArray(oldElements))
            ])
          );
        }

        if (isUpdateBlock(node) && findAncestor(node, isFunctionBlock) == template.block) {
          const bindCall = ts.createCall(
            ts.createPropertyAccess(coreIdentifier, "ɵbind"),
            undefined,
            ts.createNodeArray([init])
          );
          const instPropStmt = ts.createExpressionStatement(
            ts.createCall(
              ts.createPropertyAccess(coreIdentifier, "ɵelementProperty"),
              undefined,
              ts.createNodeArray([
                ts.createNumericLiteral(index),
                ts.createStringLiteral(propName),
                bindCall
              ])
            )
          );
          console.log("Added property assignment", propName);
          return ts.updateBlock(node, ts.createNodeArray([...node.statements, instPropStmt]));
        }

        return ts.visitEachChild(node, visitor, context);
      };

      return node => ts.visitNode(node, visitor);
    };
  }

  export function updateInstructionProperties(
    template: template.Template,
    context: SourceContext,
    index: string,
    properties: {[key: string]: string}
  ) {
    context.transforms.push(removeInstructionProperties(template, index, Object.keys(properties)));

    for (const propertyKey in properties) {
      const value = properties[propertyKey];

      let initializer: ts.Expression = valueToExpression(value);

      if (typeof value == "string" && value.indexOf("context") > -1) {
        initializer = createPropertyAccessFromString(value);
      }

      context.transforms.push(
        addInstructionProperty(template, context, index, propertyKey, initializer)
      );
    }

    context.transforms.push(updateAllConstsAndVars());
  }

  export function getInstructionProperties(node: ts.CallExpression) {
    const nodeIndex = getInstructionIndex(node);
    const parent = findAncestor(node, isFunctionBlock);
    const propertyInstructions = getAllPropertyInstructions(parent).filter(
      inst => getInstructionIndex(inst) == nodeIndex
    );
    const propertyMap: {[key: string]: string} = {};

    for (let i = 0; i < propertyInstructions.length; i++) {
      const propertyInstruction = propertyInstructions[i];
      const [, propertyNameArg, propertyValueArg] = propertyInstruction.arguments;

      const propertyName = (propertyNameArg as ts.StringLiteral).text;
      const propertyValue = (propertyValueArg as ts.CallExpression).arguments[0];

      if (
        ts.isCallExpression(propertyValue) ||
        propertyName == "routerLink" ||
        propertyName == "ngForOf"
      ) {
        continue;
      }

      if (ts.isPropertyAccessExpression(propertyValue)) {
        propertyMap[propertyName] = propertyValue.getText();
      } else {
        propertyMap[propertyName] = evaluateExpression(propertyValue);
      }
    }

    return propertyMap;
  }

  export function updateAllConstsAndVars(): ts.TransformerFactory<ts.SourceFile> {
    return context => {
      console.log("updateAllConstsAndVars");

      return (sf: ts.SourceFile) => {
        const visit: ts.Visitor = node => {
          if (
            ts.isCallExpression(node) &&
            ts.isPropertyAccessExpression(node.expression) &&
            node.expression.name.text == "ɵdefineComponent"
          ) {
            const [arg] = node.arguments;
            if (ts.isObjectLiteralExpression(arg)) {
              const templateProperty = arg.properties.find(
                prop => prop.name.getText() == "template"
              ) as ts.PropertyAssignment;

              const declaration = getFunctionDeclaration(
                sf,
                (templateProperty.initializer as ts.Identifier).text
              );

              const constsProperty = arg.properties.find(
                prop => prop.name.getText() == "consts"
              ) as ts.PropertyAssignment;

              constsProperty.initializer = ts.createLiteral(
                findMostHighIndex(declaration.body as ts.Block)
              );

              const varsProperty = arg.properties.find(
                prop => prop.name.getText() == "vars"
              ) as ts.PropertyAssignment;

              varsProperty.initializer = ts.createLiteral(
                findFirst(declaration.body, isUpdateBlock).statements.filter(
                  stmt =>
                    ts.isExpressionStatement(stmt) && isPropertyInstructionCall(stmt.expression)
                ).length || 0
              );
            } else {
              throw new Error("Cannot update root template vars and consts");
            }
            return ts.updateCall(node, node.expression, node.typeArguments, node.arguments);
          }

          if (
            ts.isCallExpression(node) &&
            ts.isPropertyAccessExpression(node.expression) &&
            node.expression.name.text == "ɵtemplate"
          ) {
            const [indexArg, templateArg, , , ...args] = node.arguments;
            const declaration = getFunctionDeclaration(sf, (templateArg as ts.Identifier).text);

            node.arguments = ts.createNodeArray([
              indexArg,
              templateArg,
              ts.createLiteral(findMostHighIndex(declaration.body as ts.Block)),
              ts.createLiteral(
                findFirst(declaration.body, isUpdateBlock).statements.filter(
                  stmt =>
                    ts.isExpressionStatement(stmt) && isPropertyInstructionCall(stmt.expression)
                ).length || 0
              ),
              ...args
            ]);

            return ts.updateCall(node, node.expression, node.typeArguments, node.arguments);
          }
          return ts.visitEachChild(node, node => visit(node), context);
        };
        return ts.visitNode(sf, visit);
      };
    };
  }

  export function getRootIdentifier(sf: ts.SourceFile) {
    function visitor(node: ts.Node) {
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text == "ɵdefineComponent"
      ) {
        const argument = node.arguments[0];
        if (!argument) {
          throw new Error("ngComponentDef should have at least one argument.");
        }

        if (ts.isObjectLiteralExpression(argument)) {
          const templateAssignment = argument.properties.find(
            p =>
              ts.isPropertyAssignment(p) &&
              ts.isIdentifier(p.name) &&
              p.name.escapedText == "template"
          ) as ts.PropertyAssignment;

          return templateAssignment.initializer;
        }
      }
      return ts.forEachChild(node, visitor);
    }

    return visitor(sf);
  }

  export function getIdentifier(index: string): Rule<Template, ts.Identifier> {
    return template => {
      const instruction = getInstruction(template, index);
      const templateArg = instruction.arguments[1];
      return templateArg as ts.Identifier;
    };
  }

  //TODO: Do not use rules for template
  export interface Template {
    block: ts.Block;
  }

  export function get(identifier: ts.Identifier, ctx: SourceContext): Template {
    assertKind(identifier, ts.SyntaxKind.Identifier);
    const typechecker = ctx.program.getTypeChecker();
    const declaration = typechecker.getSymbolAtLocation(identifier)
      .valueDeclaration as ts.FunctionDeclaration;
    return {block: declaration.body} as Template;
  }

  export function addElement(
    template: Template,
    ctx: SourceContext,
    name: string,
    importSpec: string,
    moduleSpec: string
  ): ts.TransformerFactory<ts.SourceFile>[] {
    const coreIdentifier = ctx.import.ensure("@angular/core");
    const transforms = [
      addInstruction(
        template,
        ts.createCall(
          ts.createPropertyAccess(coreIdentifier, ts.createIdentifier("ɵelement")),
          [],
          [ts.createLiteral(findSlot(template.block)), ts.createStringLiteral(name)]
        )
      )
    ];

    if (importSpec && moduleSpec) {
      transforms.push(addDirective(ctx, importSpec, moduleSpec));
    }

    return transforms;
  }

  export function addChildElement(
    template: Template,
    ctx: SourceContext,
    index: string,
    name: string,
    importSpec: string,
    moduleSpec: string
  ): ts.TransformerFactory<ts.SourceFile>[] {
    const coreIdentifier = ctx.import.ensure("@angular/core");
    const transforms = [
      addChildInstruction(
        coreIdentifier,
        template,
        index,
        ts.createCall(
          ts.createPropertyAccess(coreIdentifier, ts.createIdentifier("ɵelement")),
          [],
          [ts.createLiteral(findSlot(template.block)), ts.createStringLiteral(name)]
        )
      )
    ];

    if (importSpec && moduleSpec) {
      transforms.push(addDirective(ctx, importSpec, moduleSpec));
    }

    return transforms;
  }

  export function addElementWithContainer(
    template: Template,
    ctx: SourceContext,
    name: string,
    importSpec: string,
    moduleSpec: string
  ): ts.TransformerFactory<ts.SourceFile>[] {
    const transforms = [];
    const coreIdentifier = ctx.import.ensure("@angular/core");

    const parentIndex = findSlot(template.block);
    const childIndex = findSlot(template.block, [parentIndex]);

    const containerElement = ts.createCall(
      ts.createPropertyAccess(coreIdentifier, ts.createIdentifier("ɵelement")),
      [],
      [
        ts.createLiteral(parentIndex),
        ts.createStringLiteral("div"),
        ts.createArrayLiteral([
          ts.createLiteral("style"),
          ts.createLiteral("padding: 0 10%; box-sizing:border-box; float:left; width: 100%;")
        ])
      ]
    );
    const element = ts.createCall(
      ts.createPropertyAccess(coreIdentifier, ts.createIdentifier("ɵelement")),
      [],
      [ts.createLiteral(childIndex), ts.createStringLiteral(name)]
    );

    transforms.push(
      addInstruction(template, containerElement),
      addChildInstruction(coreIdentifier, template, String(parentIndex), element)
    );
    if (importSpec && moduleSpec) {
      transforms.push(addDirective(ctx, importSpec, moduleSpec));
    }

    return transforms;
  }

  export function updateElementStyles(
    template: Template,
    index: string,
    styles: string
  ): ts.TransformerFactory<ts.SourceFile> {
    return context => {
      console.log("updateElementStyles");

      function visitor(node: ts.Node) {
        if (
          isInstructionCall(node) &&
          getInstructionIndex(node) == index &&
          findAncestor(node, isFunctionBlock) == template.block
        ) {
          const newAttributes = [];

          const attributes = node.arguments[2] as ts.ArrayLiteralExpression;

          if (!attributes) {
            return node;
          }

          for (let i = 0; i < attributes.elements.length; i += 2) {
            const key = attributes.elements[i];
            const value = attributes.elements[i + 1];

            if (ts.isStringLiteral(key) && key.text == "style") {
              newAttributes.push(ts.createLiteral("style"), ts.createLiteral(styles));
              continue;
            }

            newAttributes.push(key, value);
          }

          return ts.updateCall(
            node,
            node.expression,
            node.typeArguments,
            ts.createNodeArray([
              node.arguments[0],
              node.arguments[1],
              ts.updateArrayLiteral(node.arguments[2] as ts.ArrayLiteralExpression, newAttributes)
            ])
          );
        }

        return ts.visitEachChild(node, node => visitor(node), context);
      }

      return node => ts.visitNode(node, visitor);
    };
  }

  export function setAttribute(
    template: Template,
    index: string,
    name: string,
    value: string
  ): ts.TransformerFactory<ts.SourceFile> {
    return context => {
      console.log("setAttribute");

      function visitor(node: ts.Node) {
        if (
          isInstructionCall(node) &&
          getInstructionIndex(node) == index &&
          findAncestor(node, isFunctionBlock) == template.block
        ) {
          const newAttributes: Array<ts.Expression> = [
            ts.createLiteral(name),
            ts.createLiteral(value)
          ];
          const attributes = node.arguments[2] as ts.ArrayLiteralExpression;

          if (attributes) {
            for (let i = 0; i < attributes.elements.length; i += 2) {
              const key = attributes.elements[i];
              const val = attributes.elements[i + 1];

              if (ts.isStringLiteral(key) && key.text == name) {
                continue;
              }

              newAttributes.push(key, val);
            }
          }

          return ts.updateCall(
            node,
            node.expression,
            node.typeArguments,
            ts.createNodeArray([
              node.arguments[0],
              node.arguments[1],
              node.arguments[2]
                ? ts.updateArrayLiteral(
                    node.arguments[2] as ts.ArrayLiteralExpression,
                    newAttributes
                  )
                : ts.createArrayLiteral(newAttributes)
            ])
          );
        }

        return ts.visitEachChild(node, node => visitor(node), context);
      }

      return node => ts.visitNode(node, visitor);
    };
  }

  // Heres is the idea how i can remove instruction
  // And it's dependencies
  // Write a preflight transformer which does
  // Nothing but defines the node should be
  // Removed from the node tree.
  // And then remove the nodes that marked as junk
  // Through a transformer
  export function removeInstruction(
    template: Template,
    index: string
  ): ts.TransformerFactory<ts.SourceFile> {
    return context => {
      console.log("removeInstruction");
      let statementsRemoved = [];
      function visitor(node: ts.Node) {
        if (isCreateBlock(node) && findAncestor(node, isFunctionBlock) == template.block) {
          const instructionIndex = node.statements.findIndex(
            stmt =>
              ts.isExpressionStatement(stmt) &&
              isInstructionCall(stmt.expression) &&
              getInstructionIndex(stmt.expression) == index
          );

          const statementsToRemove = collectInstructions(node.statements, instructionIndex);

          statementsRemoved = statementsToRemove
            .filter(s =>
              isInstructionCall(<ts.CallExpression>(<ts.ExpressionStatement>s).expression)
            )
            .map(s =>
              getInstructionIndex(<ts.CallExpression>(<ts.ExpressionStatement>s).expression)
            );

          return ts.updateBlock(
            node,
            ts.createNodeArray(node.statements.filter(s => statementsToRemove.indexOf(s) == -1))
          );
        }

        if (
          ts.isExpressionStatement(node) &&
          isPropertyInstructionCall(node.expression) &&
          findAncestor(node, isFunctionBlock) == template.block &&
          statementsRemoved.indexOf(getInstructionIndex(node.expression)) != -1
        ) {
          return ts.createNotEmittedStatement(node);
        }
        return ts.visitEachChild(node, node => visitor(node), context);
      }

      return node => ts.visitNode(node, visitor);
    };
  }

  export function moveInstruction(
    template: Template,
    index: string,
    to: "down" | "up"
  ): ts.TransformerFactory<ts.SourceFile> {
    function findPrevSiblingStart(statements: ts.NodeArray<ts.Statement>, index: number) {
      const validCalle = ["ɵelementStart", "ɵelement", "ɵtemplate"];
      let depth = 0;
      for (let i = index; i >= 0; i--) {
        const statement = statements[i];

        if (ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression)) {
          const calle = getCalle(statement.expression);
          if (calle == "ɵelementStart") {
            depth++;
          } else if (calle == "ɵelementEnd") {
            depth--;
          }
          if (validCalle.indexOf(calle) != -1 && depth == 0) {
            return statement;
          }
        }
      }
    }

    function findNextSiblingStart(statements: ts.NodeArray<ts.Statement>, index: number) {
      const validCalle = ["ɵelementStart", "ɵelement", "ɵtemplate"];
      for (let i = index; i < statements.length; i++) {
        const statement = statements[i];
        if (ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression)) {
          const calle = getCalle(statement.expression);
          if (calle == "ɵelementEnd") {
            break;
          }
          if (validCalle.indexOf(calle) != -1) {
            return statement;
          }
        }
      }
    }

    return context => {
      console.log("moveInstruction");
      function visitor(node: ts.Node) {
        if (isCreateBlock(node) && findAncestor(node, isFunctionBlock) == template.block) {
          const sourceIndex = node.statements.findIndex(
            stmt =>
              ts.isExpressionStatement(stmt) &&
              isInstructionCall(stmt.expression) &&
              getInstructionIndex(stmt.expression) == index
          );

          if (sourceIndex == -1) {
            console.log(`Cannot find the statement at index ${index}`);
            return node;
          }

          const source = collectInstructions(node.statements, sourceIndex);

          const targetStart =
            to == "up"
              ? findPrevSiblingStart(
                  node.statements,
                  node.statements.indexOf(source[0]) - 1 /* Walk up from first previous statement */
                )
              : findNextSiblingStart(
                  node.statements,
                  node.statements.indexOf(source[source.length - 1]) +
                    1 /* Walk up from next statement */
                );

          if (!targetStart) {
            console.log(`Wanted to move ${to} but the instruction does not have valid sibling.`);
            return node;
          }

          const targetIndex = node.statements.indexOf(targetStart);
          const target = collectInstructions(node.statements, targetIndex);

          const newStatements = [...node.statements];

          newStatements.splice(
            newStatements.indexOf(source[0]),
            source.length,
            ...target.map(s => ts.getMutableClone(s))
          );
          newStatements.splice(newStatements.indexOf(target[0]), target.length, ...source);

          return ts.updateBlock(node, newStatements);
        }
        return ts.visitEachChild(node, node => visitor(node), context);
      }

      return node => ts.visitNode(node, visitor);
    };
  }

  export function addChildInstruction(
    coreIdentifier: ts.Identifier,
    template: Template,
    index: string,
    expression: ts.CallExpression
  ) {
    return context => {
      function visitor(node: ts.Node) {
        if (isCreateBlock(node) && findAncestor(node, isFunctionBlock) == template.block) {
          const newStatements = [...node.statements];
          const sourceIndex = node.statements.findIndex(
            stmt =>
              ts.isExpressionStatement(stmt) &&
              isInstructionCall(stmt.expression) &&
              getInstructionIndex(stmt.expression) == index
          );

          if (sourceIndex == -1) {
            console.log(`Cannot find instruction at index ${index}`);
            return node;
          }

          const statement = <ts.ExpressionStatement>node.statements[sourceIndex];
          const call = <ts.CallExpression>statement.expression;
          const calle = getCalle(<ts.CallExpression>statement.expression);

          if (calle == "ɵelementStart") {
            const childs = collectInstructions(node.statements, sourceIndex);
            childs.splice(childs.length - 1, 0, ts.createExpressionStatement(expression));
            newStatements.splice(newStatements.indexOf(childs[0]), childs.length - 1, ...childs);
          } else if (calle == "ɵelement") {
            const childs = [];
            childs.push(
              ts.createExpressionStatement(
                ts.createCall(
                  ts.createPropertyAccess(coreIdentifier, ts.createIdentifier("ɵelementStart")),
                  call.typeArguments,
                  call.arguments
                )
              )
            );
            childs.push(ts.createExpressionStatement(expression));
            childs.push(
              ts.createExpressionStatement(
                ts.createCall(
                  ts.createPropertyAccess(coreIdentifier, ts.createIdentifier("ɵelementEnd")),
                  undefined,
                  undefined
                )
              )
            );
            newStatements.splice(sourceIndex, 1, ...childs);
          }
          return ts.updateBlock(node, newStatements);
        }
        return ts.visitEachChild(node, visitor, context);
      }
      return node => ts.visitNode(node, visitor);
    };
  }

  export function addInstructionAtIndex(
    template: Template,
    expression: ts.CallExpression,
    index: number
  ) {
    return context => {
      function visitor(node: ts.Node) {
        if (isCreateBlock(node) && findAncestor(node, isFunctionBlock) == template.block) {
          return ts.updateBlock(
            node,
            insertStatement(node.statements, index, ts.createStatement(expression))
          );
        }

        return ts.visitEachChild(node, visitor, context);
      }

      return node => ts.visitNode(node, visitor);
    };
  }

  export function addInstruction(
    template: Template,
    expression: ts.CallExpression,
    position: "after" | "before" = "after"
  ) {
    return context => {
      function visitor(node: ts.Node) {
        if (isCreateBlock(node) && findAncestor(node, isFunctionBlock) == template.block) {
          if (position == "after") {
            return ts.updateBlock(node, [
              ...node.statements,
              ts.createExpressionStatement(expression)
            ]);
          } else {
            return ts.updateBlock(node, [
              ts.createExpressionStatement(expression),
              ...node.statements
            ]);
          }
        }

        return ts.visitEachChild(node, visitor, context);
      }

      return node => ts.visitNode(node, visitor);
    };
  }

  export function getAllInstructions(node: ts.Block) {
    assertKind(node, ts.SyntaxKind.Block);
    const instructionNames = ["ɵelement", "ɵelementStart", "ɵtemplate", "ɵpipe"];
    return findAll(node, ts.isCallExpression).filter(
      n =>
        ts.isPropertyAccessExpression(n.expression) &&
        ts.isIdentifier(n.expression.name) &&
        instructionNames.indexOf(n.expression.name.escapedText.toString()) > -1
    );
  }

  export function getAllPropertyInstructions(node: ts.Block) {
    assertKind(node, ts.SyntaxKind.Block);
    return findAll(node, isPropertyInstructionCall);
  }

  export function getInstruction(template: Template, index: string) {
    return getAllInstructions(template.block).find(
      instruction => isInstructionCall(instruction) && getInstructionIndex(instruction) == index
    );
  }
}
