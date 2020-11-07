function visit(node) {
  switch (node.kind) {
    case "operator":
      return visitOperator(node);
    case "identifier":
      return visitIdentifier(node);
    case "iterable":
      return visitIterable(node);
    case "literal":
      return visitLiteral(node);
    case "macro":
      console.dir(node, {depth: Infinity});
      return () => {}
    default:
      throw new Error(`Invalid kind ${node.kind}`);
  }
}

function visitLiteral(node) {
  return () => node.value;
}

function visitIdentifier(node) {
  return ctx => ctx[node.id];
}

function visitIterable(node) {
  switch (node.type) {
    case "dictionary":
      return ctx =>
        node.list
          .map(([k, v]) => [k.id, visit(v)(ctx)])
          .reduce((t, h) => ({...t, [h[0]]: h[1]}), {});
    case "map":
      return ctx => new Map(node.list.map(([k, v]) => [visit(k)(ctx), visit(v)(ctx)]));
    case "list":
      return ctx => node.list.map(i => visit(i)(ctx));
    default:
      throw new Error(`Invalid iterable type ${node.type}`);
  }
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
    case "greater":
      return visitBinaryOperatorGreater(node);
    case "less":
      return visitBinaryOperatorLess(node);
    case "equal":
      return visitBinaryOperatorEqual(node);
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
    if (typeof data == "object" && node.rhs.id in data) {
      return data[node.rhs.id];
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

function visitBinaryOperatorLess(node) {
  return ctx => visit(node.lhs)(ctx) < visit(node.rhs)(ctx);
}

function visitBinaryOperatorEqual(node) {
  return ctx => visit(node.lhs)(ctx) == visit(node.rhs)(ctx);
}

export const compile = visit;
