import * as ts from "typescript";

export function evaluateExpression(expr: ts.Expression): any {
  function objectLiteralVisitor(expr: ts.ObjectLiteralExpression) {
    const properties = expr.properties as ts.NodeArray<ts.PropertyAssignment>;
    if (!properties) {
      return {};
    }

    const data = {};

    for (let i = 0; i < properties.length; i++) {
      const property = properties[i];

      if (ts.isIdentifier(property.name)) {
        data[property.name.text] = evaluateExpression(property.initializer);
      } else {
        console.debug(`Evaluation warning: ${ts.SyntaxKind[property.name.kind]} is not supported.`);
      }
    }
    return data;
  }
  function arrayLiteralVisitor(expr: ts.ArrayLiteralExpression) {
    const elements = expr.elements;
    if (!elements) {
      return [];
    }

    const data = [];

    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      data.push(evaluateExpression(element));
    }

    return data;
  }

  switch (expr.kind) {
    case ts.SyntaxKind.StringLiteral:
      return (<ts.StringLiteral>expr).text;
    case ts.SyntaxKind.NumericLiteral:
      return Number((<ts.NumericLiteral>expr).text);
    case ts.SyntaxKind.TrueKeyword:
    case ts.SyntaxKind.FalseKeyword:
      return Boolean((<ts.BooleanLiteral>expr).getText());
    case ts.SyntaxKind.ObjectLiteralExpression:
      return objectLiteralVisitor(<ts.ObjectLiteralExpression>expr);
    case ts.SyntaxKind.ArrayLiteralExpression:
      return arrayLiteralVisitor(<ts.ArrayLiteralExpression>expr);
    default:
      return ts.createStringLiteral(`${ts.SyntaxKind[expr.kind]}`);
  }
}

export function valueToExpression(val: any): ts.Expression {
  function objectVisitor(object: object) {
    const assignments: ts.PropertyAssignment[] = [];
    const keys = Object.keys(object);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i],
        value = object[key];

      assignments.push(ts.createPropertyAssignment(key, valueToExpression(value)));
    }
    return assignments;
  }
  function arrayVisitor(array: any[]) {
    const expressions: ts.Expression[] = [];
    for (let i = 0; i < array.length; i++) {
      expressions.push(valueToExpression(array[i]));
    }
    return expressions;
  }
  if (Array.isArray(val)) {
    return ts.createArrayLiteral(arrayVisitor(val));
  }
  switch (typeof val) {
    case "string":
    case "number":
    case "boolean":
      return ts.createLiteral(val);
    case "undefined":
      return undefined;
    case "object":
      return ts.createObjectLiteral(objectVisitor(val));
    case "symbol":
    case "function":
    default:
      return ts.createStringLiteral(`${val}`);
  }
}

/**
 * Parse down the AST and capture first node that satisfy the test.
 * @param node The start node.
 * @param test The function that tests whether a node should be included.
 * @returns a node that satisfy the test.
 */
export function findFirst<T>(node: ts.Node, test: (node: ts.Node) => node is ts.Node & T): T {
  function findFirstVisitor(n: ts.Node) {
    // Skip it self
    if (test(n)) {
      return n;
    } else {
      return n.forEachChild(findFirstVisitor);
    }
  }

  return findFirstVisitor(node);
}

/**
 * Parse down the AST and capture all the nodes that satisfy the test.
 * @param node The start node.
 * @param test The function that tests whether a node should be included.
 * @returns a collection of nodes that satisfy the test.
 */
export function findAll<T>(node: ts.Node, test: (node: ts.Node) => node is ts.Node & T): T[] {
  const nodes: T[] = [];
  findAllVisitor(node);
  return nodes;

  function findAllVisitor(n: ts.Node) {
    if (test(n)) {
      nodes.push(n);
    } else {
      n.forEachChild(child => findAllVisitor(child));
    }
  }
}

/**
 * Iterates through the parent chain of a node and performs the callback on each parent until the callback
 * returns a truthy value, then returns that value.
 * If no such value is found, it applies the callback until the parent pointer is undefined or the callback returns "quit"
 * At that point findAncestor returns undefined.
 */
export function findAncestor<T extends ts.Node>(
  node: ts.Node | undefined,
  callback: (element: ts.Node) => element is T
): T | undefined;
export function findAncestor(
  node: ts.Node | undefined,
  callback: (element: ts.Node) => boolean | "quit"
): ts.Node | undefined;
export function findAncestor(
  node: ts.Node,
  callback: (element: ts.Node) => boolean | "quit"
): ts.Node | undefined {
  node = ts.getOriginalNode(node);
  while (node) {
    const result = callback(node);
    if (result === "quit") {
      return undefined;
    } else if (result) {
      return node;
    }
    node = node.parent;
  }
  return undefined;
}

/**
 * Finds the block that has a function parent
 */
export function isFunctionBlock(node: ts.Node): node is ts.Block {
  node = ts.getOriginalNode(node);
  return ts.isBlock(node) && ts.isFunctionLike(node.parent);
}

export function isIfBlock(node: ts.Node): node is ts.Block {
  node = ts.getOriginalNode(node);
  return ts.isBlock(node) && node.parent && ts.isIfStatement(node.parent);
}

export function isUpdateBlock(node: ts.Node): node is ts.Block {
  node = ts.getOriginalNode(node);
  if (isIfBlock(node)) {
    const expr = (node.parent as ts.IfStatement).expression as ts.BinaryExpression;
    const name = getName(expr.right);
    return name && name.text == "Update";
  }
  return false;
}

export function isCreateBlock(node: ts.Node): node is ts.Block {
  node = ts.getOriginalNode(node);
  if (isIfBlock(node)) {
    const expr = (node.parent as ts.IfStatement).expression as ts.BinaryExpression;
    const name = getName(expr.right);
    return name && name.text == "Create";
  }
  return false;
}

export function createPropertyAccessFromString(val: string) {
  const keys = val.split(".");
  const last = keys.pop();
  let expression: ts.Expression = ts.createIdentifier(keys.shift());

  for (let i = 0; i < keys.length; i++) {
    expression = ts.createPropertyAccess(expression, ts.createIdentifier(keys[i]));
  }
  return ts.createPropertyAccess(expression, ts.createIdentifier(last));
}

export function isInstructionCall(node: ts.Node): node is ts.CallExpression {
  if (ts.isCallExpression(node)) {
    const instructionNames = ["ɵelement", "ɵelementStart", "ɵtemplate", "ɵpipe"];
    const name = getName(node.expression);
    return instructionNames.indexOf(name && name.text) > -1;
  }

  return false;
}

export function isPropertyInstructionCall(node: ts.Node): node is ts.CallExpression {
  if (ts.isCallExpression(node)) {
    const name = getName(node.expression);
    return name && name.text == "ɵelementProperty";
  }
  return false;
}

export function getName(node: ts.Node): ts.Identifier | null {
  if (ts.isPropertyAccessExpression(node)) {
    return node.name;
  } else if (ts.isIdentifier(node)) {
    return node;
  }
  return null;
}

export function getInstructionName(node: ts.CallExpression): string {
  return (node.arguments[1] as ts.StringLiteral).text;
}

export function getInstructionIndex(node: ts.CallExpression): string {
  return (node.arguments[0] as ts.NumericLiteral).text;
}

export function getCalle(node: ts.CallExpression): string {
  return getName(node.expression).text;
}

export function findMostHighIndex(block: ts.Block) {
  let mostHighIndex = 0;
  const createBlock = findFirst(block, isCreateBlock);
  for (let i = 0; i < createBlock.statements.length; i++) {
    const statement = createBlock.statements[i];
    if (ts.isExpressionStatement(statement) && isInstructionCall(statement.expression)) {
      const index = Number(getInstructionIndex(statement.expression));

      if (index >= mostHighIndex) {
        mostHighIndex = index + 1;
      }
    }
  }

  return mostHighIndex;
}

export function findSlot(block: ts.Block, skip: number[] = []) {
  const createBlock = findFirst(block, isCreateBlock);
  const missingSlots = (a, l = true) =>
    Array.from(Array(Math.max(...a)).keys())
      .map((n, i) => (a.indexOf(i) < 0 && (!l || i > Math.min(...a)) ? i : null))
      .filter(f => f);

  // First find used slots
  const slots = createBlock.statements
    .filter(
      statement => ts.isExpressionStatement(statement) && isInstructionCall(statement.expression)
    )
    .map(
      statement =>
        ts.isExpressionStatement(statement) &&
        Number(getInstructionIndex(<ts.CallExpression>statement.expression))
    )
    .concat(...skip);

  if (!slots.length) {
    return 0;
  }
  let suitableSlot = missingSlots(slots)[0];

  if (!suitableSlot) {
    suitableSlot = findMostHighIndex(block);
    // Find most higher that isn't skipped
    while (skip.indexOf(suitableSlot) != -1) {
      suitableSlot++;
    }
  }

  return suitableSlot;
}

export function getVars(block: ts.Block) {
  return findFirst(block, isUpdateBlock).statements.filter(
    stmt => ts.isExpressionStatement(stmt) && isPropertyInstructionCall(stmt.expression)
  ).length;
}

export function findStatementIndex(stmt: ts.Statement) {
  const originalStmt = ts.getOriginalNode(stmt, ts.isExpressionStatement);
  const parentBlock = findAncestor(originalStmt, ts.isBlock);
  return parentBlock.statements.indexOf(stmt);
}

export function insertStatement(
  arr: ReadonlyArray<ts.Statement>,
  index: number,
  newStmt: ts.Statement
): ReadonlyArray<ts.Statement> {
  return [...[...arr].slice(0, index), newStmt, ...[...arr].slice(index)];
}

export function getFunctionDeclaration(
  sf: ts.SourceFile,
  identifier: string
): ts.FunctionDeclaration | undefined {
  return sf.statements.find(statement => {
    return ts.isFunctionDeclaration(statement) && statement.name.text == identifier;
  }) as ts.FunctionDeclaration;
}

export function collectInstructions(statements: ts.NodeArray<ts.Statement>, index: number) {
  const childs: ts.Statement[] = [];
  let depth = 0;
  for (let i = index; i < statements.length; i++) {
    const statement = statements[i];
    if (ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression)) {
      const name = getCalle(statement.expression);
      if (name == "ɵelementStart") {
        depth++;
      } else if (name == "ɵelementEnd") {
        depth--;
      }
      childs.push(statement);
      console.log(depth, name);
      if (depth == 0) {
        break;
      }
    }
  }
  return childs;
}
