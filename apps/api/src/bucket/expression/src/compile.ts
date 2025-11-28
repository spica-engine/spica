import {Mode, Replacer} from "@spica-server/interface/bucket/expression";
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

function visit(node, mode: Mode) {
  if (Array.isArray(node)) {
    const fns = visitArgs(node, mode);
    return ctx => visitArgFns(fns, ctx);
  }

  switch (node.kind) {
    case "operator":
      return visitOperator(node, mode);
    case "identifier":
      return visitIdentifier(node);
    case "literal":
      return visitLiteral(node);
    case "call":
      return func.visit(
        node.left.name,
        {
          target: "default",
          arguments: node.arguments,
          receiver: undefined
        },
        mode
      );
    case "unary":
      return visitUnary(node, mode);
    default:
      throw new Error(`Invalid kind ${node.kind}`);
  }
}

function visitArgs(args: any[], mode: Mode): any[] {
  const finalResult = [];
  for (const arg of args) {
    if (Array.isArray(arg)) {
      const extracteds = visitArgs(arg, mode);
      finalResult.push(extracteds);
      continue;
    }
    const result = visit(arg, mode);

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

function visitUnary(node, mode: Mode) {
  switch (node.type) {
    case "not":
      return visitUnaryNot(node, mode);
    default:
      throw new Error(`invalid unary kind ${node.kind}`);
  }
}

function visitUnaryNot(node, mode: Mode) {
  if (node.member.type == "select" || node.member.type == "identifier") {
    throw new TypeError(
      `unary operator 'not' does not support "${node.member.type}".\nDid you mean to wrap your expression with brackets?\n!document.title=="test" -> !(document.title=="test")`
    );
  }
  return () => !visit(node.member, mode);
}

function visitOperator(node, mode: Mode) {
  switch (node.category) {
    case "binary":
      return visitBinaryOperator(node, mode);
    case "tenary":
      return visitTenaryOperator(node, mode);
    default:
      throw new Error(`unknown operator category ${node.category}`);
  }
}

function visitTenaryOperator(node, mode: Mode) {
  switch (node.type) {
    case "conditional":
      return visitTenaryOperatorConditional(node, mode);
    default:
      throw new Error(`unknown tenary operator ${node.type}`);
  }
}

function visitTenaryOperatorConditional(node, mode: Mode) {
  return ctx => {
    return visit(node.test, mode)(ctx)
      ? visit(node.consequent, mode)(ctx)
      : visit(node.alternative, mode)(ctx);
  };
}

function visitBinaryOperator(node, mode: Mode) {
  switch (node.type) {
    case "and":
      return visitBinaryOperatorAnd(node, mode);
    case "or":
      return visitBinaryOperatorOr(node, mode);
    case ">":
      return visitBinaryOperatorGreater(node, mode);
    case ">=":
      return visitBinaryOperatorGreaterOrEqual(node, mode);
    case "<":
      return visitBinaryOperatorLess(node, mode);
    case "<=":
      return visitBinaryOperatorLessOrEqual(node, mode);
    case "==":
      return visitBinaryOperatorEqual(node, mode);
    case "!=":
      return visitBinaryOperatorNotEqual(node, mode);

    case "%":
      return visitBinaryOperatorRemainder(node, mode);
    case "*":
      return visitBinaryOperatorMultiply(node, mode);
    case "/":
      return visitBinaryOperatorDivide(node, mode);

    case "+":
      return visitBinaryOperatorAdd(node, mode);
    case "-":
      return visitBinaryOperatorSubtract(node, mode);

    case "select":
      return visitBinaryOperatorSelect(node, mode);
    default:
      throw new Error(`unknown binary operator ${node.type}`);
  }
}

function visitBinaryOperatorSelect(node, mode: Mode) {
  return ctx => {
    const left = visit(node.left, mode);
    const data = left(ctx);
    if (typeof data == "object" && data != null && node.right.name in data) {
      return data[node.right.name];
    }
    return undefined;
  };
}

function visitBinaryOperatorAnd(node, mode: Mode) {
  return ctx => visit(node.left, mode)(ctx) && visit(node.right, mode)(ctx);
}

function visitBinaryOperatorOr(node, mode: Mode) {
  return ctx => visit(node.left, mode)(ctx) || visit(node.right, mode)(ctx);
}

function visitBinaryOperatorGreater(node, mode: Mode) {
  return ctx => visit(node.left, mode)(ctx) > visit(node.right, mode)(ctx);
}

function visitBinaryOperatorGreaterOrEqual(node, mode: Mode) {
  return ctx => visit(node.left, mode)(ctx) >= visit(node.right, mode)(ctx);
}

function visitBinaryOperatorLess(node, mode: Mode) {
  return ctx => visit(node.left, mode)(ctx) < visit(node.right, mode)(ctx);
}

function visitBinaryOperatorLessOrEqual(node, mode: Mode) {
  return ctx => visit(node.left, mode)(ctx) <= visit(node.right, mode)(ctx);
}

function visitBinaryOperatorEqual(node, mode: Mode) {
  return ctx => visit(node.left, mode)(ctx) == visit(node.right, mode)(ctx);
}

function visitBinaryOperatorNotEqual(node, mode: Mode) {
  return ctx => visit(node.left, mode)(ctx) != visit(node.right, mode)(ctx);
}

function visitBinaryOperatorRemainder(node, mode: Mode) {
  return ctx => visit(node.left, mode)(ctx) % visit(node.right, mode)(ctx);
}

function visitBinaryOperatorMultiply(node, mode: Mode) {
  return ctx => visit(node.left, mode)(ctx) * visit(node.right, mode)(ctx);
}

function visitBinaryOperatorDivide(node, mode: Mode) {
  return ctx => visit(node.left, mode)(ctx) / visit(node.right, mode)(ctx);
}

function visitBinaryOperatorAdd(node, mode: Mode) {
  return ctx => visit(node.left, mode)(ctx) + visit(node.right, mode)(ctx);
}

function visitBinaryOperatorSubtract(node, mode: Mode) {
  return ctx => visit(node.left, mode)(ctx) - visit(node.right, mode)(ctx);
}

export const compile = visit;
