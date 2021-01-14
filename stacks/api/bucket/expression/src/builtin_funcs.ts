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
      let propertyName: string;
      const includedItems: unknown[] = [];

      for (const [index, argument] of context.arguments.entries()) {
        const item = convert(argument)(ctx);

        if (index == 0) {
          // @TODO: remove this replace part when find a way to send '$in' operator inside of "$expr"
          // it will cause an error if field does not exist on document
          propertyName = item.replace("$", "");
        } else {
          includedItems.push(item);
        }
      }

      return {[propertyName]: {$in: includedItems}};
    } else {
      let documentValue: unknown[];
      const includedItems: unknown[] = [];

      for (const [index, argument] of context.arguments.entries()) {
        const item = compile(argument)(ctx);

        if (index == 0) {
          documentValue = item;
        } else {
          includedItems.push(item);
        }
      }

      let isContain = false;

      for (const value of documentValue) {
        if (includedItems.includes(value)) {
          isContain = true;
          break;
        }
      }

      return isContain;
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
      let propertyName: string;
      const includedItems: unknown[] = [];

      for (const [index, argument] of context.arguments.entries()) {
        const item = convert(argument)(ctx);

        if (index == 0) {
          // @TODO: remove this replace part when find a way to send '$in' operator inside of "$expr"
          // it will cause an error if field does not exist on document => "$in requires an array as a second argument, found: missing"
          propertyName = item.replace("$", "");
        } else {
          includedItems.push(item);
        }
      }

      return {[propertyName]: {$all: includedItems}};
    } else {
      let documentValue: unknown[];
      const includedItems: unknown[] = [];

      for (const [index, argument] of context.arguments.entries()) {
        const item = compile(argument)(ctx);

        if (index == 0) {
          documentValue = item;
        } else {
          includedItems.push(item);
        }
      }

      let isContain = true;

      for (const included of includedItems) {
        if (!documentValue.includes(included)) {
          isContain = false;
          break;
        }
      }

      return isContain;
    }
  };
};
