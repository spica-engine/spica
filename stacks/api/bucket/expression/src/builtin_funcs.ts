import * as func from "./func";
import {convert} from "./convert";
import {compile} from "./compile";

export const has: func.Func = context => {
  const [node] = context.arguments;

  if (node.type != "select" && node.kind != "identifier") {
    throw new TypeError(`'has' only accepts property access chain or identifier.`);
  }

  if (context.arguments.length > 1) {
    throw new TypeError(`'has' only accepts only one argument.`);
  }

  return ctx => {
    const propertyName: string = convert(context.arguments[0])(ctx);
    if (context.target == "aggregation") {
      // we can not use $exists since it is a query operator which we can't use as an logical operator
      // so we use a clever trick to see if "type number" of the field is greater than "null's" type number
      // https://docs.mongodb.com/manual/reference/bson-types/#bson-types-comparison-order
      return {$expr: {$gt: [propertyName, null]}};
    } else {
      return ctx && propertyName in ctx;
    }
  };
};

export const some: func.Func = context => {
  const [node] = context.arguments;

  if (node.type != "select" && node.kind != "identifier") {
    throw new TypeError(`'some' only accepts property access chain or identifier.`);
  }

  if (context.arguments.length < 2) {
    throw new TypeError(`'some' accepts minimun two arguments.`);
  }

  return ctx => {
    if (context.target == "aggregation") {
      // @TODO: remove this replace("$","") when find a way to send '$in' operator inside of "$expr"
      // we know first item is property name
      const propertyName: string = convert(context.arguments[0])(ctx).replace("$", "");
      const includedItems: unknown[] = argumentToValue(context.arguments.splice(1), ctx, convert);

      return {[propertyName]: {$in: includedItems}};
    } else {
      const documentValue: unknown[] = compile(context.arguments[0])(ctx);
      const includedItems: unknown[] = argumentToValue(context.arguments.splice(1), ctx, compile);

      return includedItems.some(included => documentValue.includes(included));
    }
  };
};

export const every: func.Func = context => {
  const [node] = context.arguments;

  if (node.type != "select" && node.kind != "identifier") {
    throw new TypeError(`'every' only accepts property access chain or identifier.`);
  }

  if (context.arguments.length < 2) {
    throw new TypeError(`'every' accepts minimun two arguments.`);
  }

  return ctx => {
    if (context.target == "aggregation") {
      const propertyName: string = convert(context.arguments[0])(ctx).replace("$", "");
      const includedItems: unknown[] = argumentToValue(context.arguments.splice(1), ctx, convert);

      return {[propertyName]: {$all: includedItems}};
    } else {
      const documentValue: unknown[] = compile(context.arguments[0])(ctx);
      const includedItems: unknown[] = argumentToValue(context.arguments.splice(1), ctx, compile);

      return includedItems.every(included => documentValue.includes(included));
    }
  };
};

export const equal: func.Func = context => {
  const [node] = context.arguments;

  if (node.type != "select" && node.kind != "identifier") {
    throw new TypeError(`'equal' only accepts property access chain or identifier.`);
  }

  if (context.arguments.length < 2) {
    throw new TypeError(`'equal' accepts two arguments.`);
  }

  return ctx => {
    if (context.target == "aggregation") {
      const propertyName: string = convert(context.arguments[0])(ctx);
      const items: unknown[] = argumentToValue(context.arguments.splice(1), ctx, convert);

      return {$expr: {$eq: [propertyName, items]}};
    } else {
      const documentValue: unknown[] = compile(context.arguments[0])(ctx);
      const items: unknown[] = argumentToValue(context.arguments.splice(1), ctx, compile);

      return (
        items.every(item => documentValue.includes(item)) && documentValue.length == items.length
      );
    }
  };
};

function argumentToValue(args: object[], ctx: object, builder: Function) {
  const items = [];

  for (const argument of args) {
    const item = builder(argument)(ctx);

    items.push(item);
  }

  return items;
}
