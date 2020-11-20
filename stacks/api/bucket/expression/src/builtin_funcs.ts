import * as func from "./func";
import {convert} from "./convert";

export const has: func.Func = context => {
  const [node] = context.arguments;

  if (node.type != "select" && node.kind != "identifier") {
    throw new TypeError(`'has' only accepts property access chain or identifier.`);
  }

  if (context.arguments.length > 1) {
    throw new TypeError(`'has' only accepts only one argument.`);
  }

  return ctx => {
    if (context.target == "aggregation") {
      const propertyName: string = convert(context.arguments[0])(ctx);
      return {
        [propertyName.slice(1)]: {
          $exists: true
        }
      };
    }
  };
};
