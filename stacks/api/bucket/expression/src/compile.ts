import * as func from "./func";

function visit(node) {
  switch (node.kind) {
    case "operator":
      return visitOperator(node);
    case "identifier":
      return visitIdentifier(node);
    case "literal":
      return visitLiteral(node);
    case "call":
      return func.visit(node.lhs.name, {
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
    default:
      throw new Error(`unknown operator category ${node.category}`);
  }
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
    const lhs = visit(node.lhs);
    const data = lhs(ctx);
    if (typeof data == "object" && data != null && node.rhs.name in data) {
      return data[node.rhs.name];
    }
    return undefined;
  };
}

function visitBinaryOperatorAnd(node) {
  return ctx => visit(node.lhs)(ctx) && visit(node.rhs)(ctx);
}

function visitBinaryOperatorOr(node) {
  return ctx => visit(node.lhs)(ctx) || visit(node.rhs)(ctx);
}

function visitBinaryOperatorGreater(node) {
  return ctx => visit(node.lhs)(ctx) > visit(node.rhs)(ctx);
}

function visitBinaryOperatorGreaterOrEqual(node) {
  return ctx => visit(node.lhs)(ctx) >= visit(node.rhs)(ctx);
}

function visitBinaryOperatorLess(node) {
  return ctx => visit(node.lhs)(ctx) < visit(node.rhs)(ctx);
}

function visitBinaryOperatorLessOrEqual(node) {
  return ctx => visit(node.lhs)(ctx) <= visit(node.rhs)(ctx);
}

function visitBinaryOperatorEqual(node) {
  return ctx => visit(node.lhs)(ctx) == visit(node.rhs)(ctx);
}

function visitBinaryOperatorNotEqual(node) {
  return ctx => visit(node.lhs)(ctx) != visit(node.rhs)(ctx);
}

function visitBinaryOperatorRemainder(node) {
  return ctx => visit(node.lhs)(ctx) % visit(node.rhs)(ctx);
}

function visitBinaryOperatorMultiply(node) {
  return ctx => visit(node.lhs)(ctx) * visit(node.rhs)(ctx);
}

function visitBinaryOperatorDivide(node) {
  return ctx => visit(node.lhs)(ctx) / visit(node.rhs)(ctx);
}

function visitBinaryOperatorAdd(node) {
  return ctx => visit(node.lhs)(ctx) + visit(node.rhs)(ctx);
}

function visitBinaryOperatorSubtract(node) {
  return ctx => visit(node.lhs)(ctx) - visit(node.rhs)(ctx);
}

export const compile = visit;
