import {ObjectId} from "@spica-server/database";
import {getMostLeftSelectIdentifier} from "./ast";
import {compile} from "./compile";
import * as func from "./func";
import {Mode, Replacer} from "@spica-server/interface/bucket/expression";

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

  replacers.forEach(replacer => {
    if (replacer.condition(node)) {
      replacer.replace(node);
    }
  });

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
          target: "aggregation",
          arguments: node.arguments,
          receiver: undefined
        },
        mode
      );
    case "unary":
      return visitUnary(node, mode);
    default:
      throw new Error(`invalid kind ${node.kind}`);
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
  return () => {
    if (node.parent && node.parent.type != "select") {
      return `$${node.name}`;
    }
    return node.name;
  };
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
  return ctx => {
    // $not is not accepted as a top level operator
    // see: https://jira.mongodb.org/browse/SERVER-10708
    return {$nor: [visit(node.member, mode)(ctx)]};
  };
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
    const test = visit(node.test, mode)(ctx);
    return {
      $or: [
        {
          $and: [test, visit(node.consequent, mode)(ctx)]
        },
        {
          $and: [{$nor: [test]}, visit(node.alternative, mode)(ctx)]
        }
      ]
    };
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
    const left = visit(node.left, mode)(ctx);

    const mostLeft = getMostLeftSelectIdentifier(node);

    if (mostLeft == "auth") {
      return compile(node, mode)(ctx);
    }

    const right = visit(node.right, mode)(ctx);

    let path = `${left}.${right}`;

    if (left == "document") {
      path = right;
    }

    if (!node.parent || node.parent.type != "select") {
      path = `$${path}`;
    }

    return path;
  };
}

function visitBinaryOperatorAnd(node, mode: Mode) {
  return ctx => {
    return {
      $and: [visit(node.left, mode)(ctx), visit(node.right, mode)(ctx)]
    };
  };
}

function visitBinaryOperatorOr(node, mode: Mode) {
  return ctx => {
    return {
      $or: [visit(node.left, mode)(ctx), visit(node.right, mode)(ctx)]
    };
  };
}

export function wrapExpressionByMode(expression: object, mode: Mode) {
  switch (mode) {
    case "match":
      return {$expr: expression};
    case "project":
      return expression;
    default:
      throw Error("Unknown mode received.");
  }
}

function visitBinaryOperatorGreater(node, mode: Mode) {
  return ctx => {
    const expression = {$gt: [visit(node.left, mode)(ctx), visit(node.right, mode)(ctx)]};
    return wrapExpressionByMode(expression, mode);
  };
}

function visitBinaryOperatorGreaterOrEqual(node, mode: Mode) {
  return ctx => {
    const expression = {$gte: [visit(node.left, mode)(ctx), visit(node.right, mode)(ctx)]};
    return wrapExpressionByMode(expression, mode);
  };
}

function visitBinaryOperatorLess(node, mode: Mode) {
  return ctx => {
    const expression = {$lt: [visit(node.left, mode)(ctx), visit(node.right, mode)(ctx)]};
    return wrapExpressionByMode(expression, mode);
  };
}

function visitBinaryOperatorLessOrEqual(node, mode: Mode) {
  return ctx => {
    const expression = {$lte: [visit(node.left, mode)(ctx), visit(node.right, mode)(ctx)]};
    return wrapExpressionByMode(expression, mode);
  };
}

function visitBinaryOperatorEqual(node, mode: Mode) {
  return ctx => {
    const expression = {$eq: [visit(node.left, mode)(ctx), visit(node.right, mode)(ctx)]};
    return wrapExpressionByMode(expression, mode);
  };
}

function visitBinaryOperatorNotEqual(node, mode: Mode) {
  return ctx => {
    const expression = {$ne: [visit(node.left, mode)(ctx), visit(node.right, mode)(ctx)]};
    return wrapExpressionByMode(expression, mode);
  };
}

function visitBinaryOperatorRemainder(node, mode: Mode) {
  return ctx => {
    return {$mod: [visit(node.left, mode)(ctx), visit(node.right, mode)(ctx)]};
  };
}

function visitBinaryOperatorMultiply(node, mode: Mode) {
  return ctx => {
    return {$multiply: [visit(node.left, mode)(ctx), visit(node.right, mode)(ctx)]};
  };
}

function visitBinaryOperatorDivide(node, mode: Mode) {
  return ctx => {
    return {$divide: [visit(node.left, mode)(ctx), visit(node.right, mode)(ctx)]};
  };
}

function visitBinaryOperatorAdd(node, mode: Mode) {
  return ctx => {
    return {$add: [visit(node.left, mode)(ctx), visit(node.right, mode)(ctx)]};
  };
}

function visitBinaryOperatorSubtract(node, mode: Mode) {
  return ctx => {
    return {$subtract: [visit(node.left, mode)(ctx), visit(node.right, mode)(ctx)]};
  };
}

export const convert = visit;

// REPLACEMENTS

// ObjectId
const ObjectIdReplacer: Replacer = {
  condition: node => {
    return (
      (isIdSide(node.left) && isValueSide(node.right)) ||
      (isIdSide(node.right) && isValueSide(node.left))
    );
  },
  replace: node => {
    if (isIdSide(node.left) && isValueSide(node.right)) {
      node.right.value = new ObjectId(node.right.value);
    } else if (isIdSide(node.right) && isValueSide(node.left)) {
      node.left.value = new ObjectId(node.left.value);
    }
  }
};

function isIdSide(node) {
  return isOperator(node) && isIdIdentifier(node.right);
}

function isOperator(node) {
  return node && node.kind == "operator" && node.type == "select";
}

function isIdIdentifier(node) {
  return node && node.kind == "identifier" && node.name == "_id";
}

function isValueSide(node) {
  return node && node.kind == "literal" && node.type == "string";
}

// define and add custom replacers here
const replacers = [ObjectIdReplacer];
