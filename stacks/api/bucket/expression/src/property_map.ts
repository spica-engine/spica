import {getMostLeftSelectIdentifier} from "./ast";

function visit(node) {
  switch (node.kind) {
    case "operator":
      return visitNode(node);
    case "identifier":
      return visitIdentifier(node);
    case "call":
      return visitNode(node.arguments[0]);
    case "unary":
      return visitUnary(node);
  }
}

function visitIdentifier(node) {
  return node.name;
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
  return visit(node.member);
}

function visitBinaryOperatorSelect(node) {
  const lhs = visit(node.lhs);

  const mostLeft = getMostLeftSelectIdentifier(node);

  if (mostLeft == "auth") {
    return undefined;
  }

  const rhs = visit(node.rhs);

  let path = `${lhs}.${rhs}`;

  if (lhs == "document") {
    path = rhs;
  }

  return path;
}

function visitNode(node) {
  if (node.kind == "operator" && node.type == "select") {
    const result = visitBinaryOperatorSelect(node);
    return result ? [result] : [];
  }
  const lhs = visit(node.lhs);
  const rhs = visit(node.rhs);
  const result = [];

  if (lhs) {
    if (Array.isArray(lhs)) {
      result.push(...lhs);
    } else {
      result.push(lhs);
    }
  }

  if (rhs) {
    if (Array.isArray(rhs)) {
      result.push(...rhs);
    } else {
      result.push(rhs);
    }
  }

  return result;
}

export const extract = node => {
  return Array.from<string>(new Set(visit(node)));
};
