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
      const parsedArguments = parseArguments(context.arguments, ctx, convert);

      const propertyName: string = parsedArguments[0];
      const includedItems: unknown[] = parsedArguments.splice(1);

      return createInQuery(includedItems, propertyName, "$or");
    } else {
      const parsedArguments = parseArguments(context.arguments, ctx, compile);

      const documentValue: unknown[] = parsedArguments[0];
      const includedItems: unknown[] = parsedArguments.splice(1);

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
      const parsedArguments = parseArguments(context.arguments, ctx, convert);

      const propertyName: string = parsedArguments[0];
      const includedItems: unknown[] = parsedArguments.splice(1);

      return createInQuery(includedItems, propertyName, "$and");
    } else {
      const parsedArguments = parseArguments(context.arguments, ctx, compile);

      const documentValue: unknown[] = parsedArguments[0];
      const includedItems: unknown[] = parsedArguments.splice(1);

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
    throw new TypeError(`'equal' accepts minimum two arguments.`);
  }

  return ctx => {
    if (context.target == "aggregation") {
      const parsedArguments = parseArguments(context.arguments, ctx, convert);

      const propertyName: string = parsedArguments[0];
      const items: unknown[] = parsedArguments.splice(1);

      const match = {
        $expr: {
          $and: [
            {
              $eq: [
                {
                  $size: {
                    $ifNull: [propertyName, []]
                  }
                },
                items.length
              ]
            },
            {
              $eq: [
                {
                  $setDifference: [propertyName, items]
                },
                []
              ]
            }
          ]
        }
      };

      return match;
    } else {
      const parsedArguments = parseArguments(context.arguments, ctx, compile);

      const documentValue: unknown[] = parsedArguments[0];
      const items: unknown[] = parsedArguments.splice(1);

      return (
        documentValue.length == items.length && items.every(item => documentValue.includes(item))
      );
    }
  };
};

export const regex: func.Func = context => {
  const [node] = context.arguments;

  if (node.type != "select" && node.kind != "identifier") {
    throw new TypeError(`'regex' only accepts property access chain or identifier.`);
  }

  if (!(context.arguments.length == 2 || context.arguments.length == 3)) {
    throw new TypeError(`'regex' accepts two or three arguments.`);
  }

  return ctx => {
    if (context.target == "aggregation") {
      const parsedArguments = parseArguments(context.arguments, ctx, convert);

      const propertyName: string = parsedArguments[0];
      const regex: string = parsedArguments[1];
      const options: string = parsedArguments[2] || "";

      return {
        $expr: {
          $eq: [
            {
              $regexMatch: {
                input: propertyName,
                regex: regex,
                options: options
              }
            },
            true
          ]
        }
      };
    } else {
      const parsedArguments = parseArguments(context.arguments, ctx, compile);

      const documentValue: string = parsedArguments[0];
      const regex: string = parsedArguments[1];
      const options: string = parsedArguments[2] || "";

      return RegExp(regex, options).test(documentValue);
    }
  };
};

function parseArguments(args: object[], ctx: object, builder: Function) {
  const items = [];

  for (const argument of args) {
    const item = builder(argument)(ctx);

    items.push(item);
  }

  return items;
}

function createInQuery(items: unknown[], propertyName: string, operator: "$and" | "$or") {
  const query = {
    [operator]: []
  };

  for (const item of items) {
    const expression = {
      $expr: {
        $eq: [
          {
            $in: [
              item,
              {
                $ifNull: [propertyName, []]
              }
            ]
          },
          true
        ]
      }
    };

    query[operator].push(expression);
  }

  return query;
}
