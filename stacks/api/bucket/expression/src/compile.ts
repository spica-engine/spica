import * as func from "./func";

function visitArgFns(fns: any[], ctx) {
  const finalResult = [];
  for (const fn of fns) {
    if (Array.isArray(fn)) {
      const extractedFn = visitArgFns(fn, ctx);
      finalResult.push(extractedFn);
      continue;
    }

    const result = fn(ctx);
    finalResult.push(result);
  }
  return finalResult;
}

function visit(node) {
  if (Array.isArray(node)) {
    const fns = visitArgs(node);
    return ctx => visitArgFns(fns, ctx);
  }
  switch (node.kind) {
    case "operator":
      return visitOperator(node);
    case "identifier":
      return visitIdentifier(node);
    case "literal":
      return visitLiteral(node);
    case "call":
      return func.visit(node.left.name, {
        target: "default",
        arguments: node.arguments,
        receiver: undefined
      });
    case "unary":
      return visitUnary(node);
    default:
      throw new Error(`Invalid kind ${node.kind}`);
  }
}

function visitArgs(args: any[]): any[] {
  const finalResult = [];
  for (const arg of args) {
    if (Array.isArray(arg)) {
      const extracteds = visitArgs(arg);
      finalResult.push(extracteds);
      continue;
    }
    const result = visit(arg);

    if (Array.isArray(result)) {
      finalResult.push(...result);
    } else if (result != undefined) {
      finalResult.push(result);
    }
  }
  return finalResult;
}

function visitLiteral(node) {
  return () => node.value;
}

function visitIdentifier(node) {
  return ctx => ctx[node.name];
}

function visitUnary(node) {
  switch (node.type) {
    case "not":
      return visitUnaryNot(node);
    default:
      throw new Error(`invalid unary kind ${node.kind}`);
  }
}

function visitUnaryNot(node) {
  if (node.member.type == "select" || node.member.type == "identifier") {
    throw new TypeError(
      `unary operator 'not' does not support "${node.member.type}".\nDid you mean to wrap your expression with brackets?\n!document.title=="test" -> !(document.title=="test")`
    );
  }
  return () => !visit(node.member);
}

function visitOperator(node) {
  switch (node.category) {
    case "binary":
      return visitBinaryOperator(node);
    case "tenary":
      return visitTenaryOperator(node);
    default:
      throw new Error(`unknown operator category ${node.category}`);
  }
}

function visitTenaryOperator(node) {
  switch (node.type) {
    case "conditional":
      return visitTenaryOperatorConditional(node);
    default:
      throw new Error(`unknown tenary operator ${node.type}`);
  }
}

function visitTenaryOperatorConditional(node) {
  return ctx => {
    return visit(node.test)(ctx) ? visit(node.consequent)(ctx) : visit(node.alternative)(ctx);
  };
}

function visitBinaryOperator(node) {
  switch (node.type) {
    case "and":
      return visitBinaryOperatorAnd(node);
    case "or":
      return visitBinaryOperatorOr(node);
    case ">":
      return visitBinaryOperatorGreater(node);
    case ">=":
      return visitBinaryOperatorGreaterOrEqual(node);
    case "<":
      return visitBinaryOperatorLess(node);
    case "<=":
      return visitBinaryOperatorLessOrEqual(node);
    case "==":
      return visitBinaryOperatorEqual(node);
    case "!=":
      return visitBinaryOperatorNotEqual(node);

    case "%":
      return visitBinaryOperatorRemainder(node);
    case "*":
      return visitBinaryOperatorMultiply(node);
    case "/":
      return visitBinaryOperatorDivide(node);

    case "+":
      return visitBinaryOperatorAdd(node);
    case "-":
      return visitBinaryOperatorSubtract(node);

    case "select":
      return visitBinaryOperatorSelect(node);
    default:
      throw new Error(`unknown binary operator ${node.type}`);
  }
}

function visitBinaryOperatorSelect(node) {
  return ctx => {
    const left = visit(node.left);
    const data = left(ctx);
    if (typeof data == "object" && data != null && node.right.name in data) {
      return data[node.right.name];
    }
    return undefined;
  };
}

function visitBinaryOperatorAnd(node) {
  return ctx => visit(node.left)(ctx) && visit(node.right)(ctx);
}

function visitBinaryOperatorOr(node) {
  return ctx => visit(node.left)(ctx) || visit(node.right)(ctx);
}

function visitBinaryOperatorGreater(node) {
  return ctx => visit(node.left)(ctx) > visit(node.right)(ctx);
}

function visitBinaryOperatorGreaterOrEqual(node) {
  return ctx => visit(node.left)(ctx) >= visit(node.right)(ctx);
}

function visitBinaryOperatorLess(node) {
  return ctx => visit(node.left)(ctx) < visit(node.right)(ctx);
}

function visitBinaryOperatorLessOrEqual(node) {
  return ctx => visit(node.left)(ctx) <= visit(node.right)(ctx);
}

function visitBinaryOperatorEqual(node) {
  return ctx => visit(node.left)(ctx) == visit(node.right)(ctx);
}

function visitBinaryOperatorNotEqual(node) {
  return ctx => visit(node.left)(ctx) != visit(node.right)(ctx);
}

function visitBinaryOperatorRemainder(node) {
  return ctx => visit(node.left)(ctx) % visit(node.right)(ctx);
}

function visitBinaryOperatorMultiply(node) {
  return ctx => visit(node.left)(ctx) * visit(node.right)(ctx);
}

function visitBinaryOperatorDivide(node) {
  return ctx => visit(node.left)(ctx) / visit(node.right)(ctx);
}

function visitBinaryOperatorAdd(node) {
  return ctx => visit(node.left)(ctx) + visit(node.right)(ctx);
}

function visitBinaryOperatorSubtract(node) {
  return ctx => visit(node.left)(ctx) - visit(node.right)(ctx);
}

export const compile = visit;
