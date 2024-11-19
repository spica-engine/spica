import {ObjectId} from "@spica/database";
import {getMostLeftSelectIdentifier} from "./ast";
import {compile} from "./compile";
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

  replacers.forEach(replacer => {
    if (replacer.condition(node)) {
      replacer.replace(node);
    }
  });

  switch (node.kind) {
    case "operator":
      return visitOperator(node);
    case "identifier":
      return visitIdentifier(node);
    case "literal":
      return visitLiteral(node);
    case "call":
      return func.visit(node.left.name, {
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
  return () => {
    if (node.parent && node.parent.type != "select") {
      return `$${node.name}`;
    }
    return node.name;
  };
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
  return ctx => {
    // $not is not accepted as a top level operator
    // see: https://jira.mongodb.org/browse/SERVER-10708
    return {$nor: [visit(node.member)(ctx)]};
  };
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
    const test = visit(node.test)(ctx);
    return {
      $or: [
        {
          $and: [test, visit(node.consequent)(ctx)]
        },
        {
          $and: [{$nor: [test]}, visit(node.alternative)(ctx)]
        }
      ]
    };
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
    const left = visit(node.left)(ctx);

    const mostLeft = getMostLeftSelectIdentifier(node);

    if (mostLeft == "auth") {
      return compile(node)(ctx);
    }

    const right = visit(node.right)(ctx);

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

function visitBinaryOperatorAnd(node) {
  return ctx => {
    return {
      $and: [visit(node.left)(ctx), visit(node.right)(ctx)]
    };
  };
}

function visitBinaryOperatorOr(node) {
  return ctx => {
    return {
      $or: [visit(node.left)(ctx), visit(node.right)(ctx)]
    };
  };
}

function visitBinaryOperatorGreater(node) {
  return ctx => {
    return {$expr: {$gt: [visit(node.left)(ctx), visit(node.right)(ctx)]}};
  };
}

function visitBinaryOperatorGreaterOrEqual(node) {
  return ctx => {
    return {$expr: {$gte: [visit(node.left)(ctx), visit(node.right)(ctx)]}};
  };
}

function visitBinaryOperatorLess(node) {
  return ctx => {
    return {$expr: {$lt: [visit(node.left)(ctx), visit(node.right)(ctx)]}};
  };
}

function visitBinaryOperatorLessOrEqual(node) {
  return ctx => {
    return {$expr: {$lte: [visit(node.left)(ctx), visit(node.right)(ctx)]}};
  };
}

function visitBinaryOperatorEqual(node) {
  return ctx => {
    return {$expr: {$eq: [visit(node.left)(ctx), visit(node.right)(ctx)]}};
  };
}

function visitBinaryOperatorNotEqual(node) {
  return ctx => {
    return {$expr: {$ne: [visit(node.left)(ctx), visit(node.right)(ctx)]}};
  };
}

function visitBinaryOperatorRemainder(node) {
  return ctx => {
    return {$mod: [visit(node.left)(ctx), visit(node.right)(ctx)]};
  };
}

function visitBinaryOperatorMultiply(node) {
  return ctx => {
    return {$multiply: [visit(node.left)(ctx), visit(node.right)(ctx)]};
  };
}

function visitBinaryOperatorDivide(node) {
  return ctx => {
    return {$divide: [visit(node.left)(ctx), visit(node.right)(ctx)]};
  };
}

function visitBinaryOperatorAdd(node) {
  return ctx => {
    return {$add: [visit(node.left)(ctx), visit(node.right)(ctx)]};
  };
}

function visitBinaryOperatorSubtract(node) {
  return ctx => {
    return {$subtract: [visit(node.left)(ctx), visit(node.right)(ctx)]};
  };
}

export const convert = visit;

// REPLACEMENTS
interface Replacer {
  condition: (...args) => boolean;
  replace: (...args) => void;
}

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
