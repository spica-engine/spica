import {getMostLeftSelectIdentifier, isSelectChain} from "./ast";
import {compile} from "./compile";
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
        target: "aggregation",
        arguments: node.arguments,
        receiver: undefined
      });
    case "unary":
      return visitUnary(node);
    default:
      throw new Error(`invalid kind ${node.kind}`);
  }
}

function visitLiteral(node) {
  return () => node.value;
}

function visitIdentifier(node) {
  return () => node.name;
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
  return () => {
    return {$not: visit(node.member)};
  };
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
    const lhs = visit(node.lhs)(ctx);

    const mostLeft = getMostLeftSelectIdentifier(node);

    if (mostLeft == "auth") {
      return compile(node)(ctx);
    }

    const rhs = visit(node.rhs)(ctx);

    let path = `${lhs}.${rhs}`;

    if (lhs == "document") {
      path = rhs;
    }

    if (isSelectChain(node)) {
      path = `$${path}`;
    }

    return path;
  };
}

function visitBinaryOperatorAnd(node) {
  return ctx => {
    return {
      $and: [visit(node.lhs)(ctx), visit(node.rhs)(ctx)]
    };
  };
}

function visitBinaryOperatorOr(node) {
  return ctx => {
    return {
      $or: [visit(node.lhs)(ctx), visit(node.rhs)(ctx)]
    };
  };
}

function visitBinaryOperatorGreater(node) {
  return ctx => {
    return {$expr: {$gt: [visit(node.lhs)(ctx), visit(node.rhs)(ctx)]}};
  };
}

function visitBinaryOperatorGreaterOrEqual(node) {
  return ctx => {
    return {$expr: {$gte: [visit(node.lhs)(ctx), visit(node.rhs)(ctx)]}};
  };
}

function visitBinaryOperatorLess(node) {
  return ctx => {
    return {$expr: {$lt: [visit(node.lhs)(ctx), visit(node.rhs)(ctx)]}};
  };
}

function visitBinaryOperatorLessOrEqual(node) {
  return ctx => {
    return {$expr: {$lte: [visit(node.lhs)(ctx), visit(node.rhs)(ctx)]}};
  };
}

function visitBinaryOperatorEqual(node) {
  return ctx => {
    return {$expr: {$eq: [visit(node.lhs)(ctx), visit(node.rhs)(ctx)]}};
  };
}

function visitBinaryOperatorNotEqual(node) {
  return ctx => {
    return {$expr: {$ne: [visit(node.lhs)(ctx), visit(node.rhs)(ctx)]}};
  };
}

function visitBinaryOperatorRemainder(node) {
  return ctx => {
    return {$mod: [visit(node.lhs)(ctx), visit(node.rhs)(ctx)]};
  };
}

function visitBinaryOperatorMultiply(node) {
  return ctx => {
    return {$multiply: [visit(node.lhs)(ctx), visit(node.rhs)(ctx)]};
  };
}

function visitBinaryOperatorDivide(node) {
  return ctx => {
    return {$divide: [visit(node.lhs)(ctx), visit(node.rhs)(ctx)]};
  };
}

function visitBinaryOperatorAdd(node) {
  return ctx => {
    return {$add: [visit(node.lhs)(ctx), visit(node.rhs)(ctx)]};
  };
}

function visitBinaryOperatorSubtract(node) {
  return ctx => {
    return {$subtract: [visit(node.lhs)(ctx), visit(node.rhs)(ctx)]};
  };
}

export const convert = visit;
