import * as func from "./func";
import {convert} from "./convert";
import {compile} from "./compile";

export const has: func.Func = context => {
  const fnName = "has";
  validateArgumentsLength(fnName, context.arguments, 1);
  validateArgumentsNode(fnName, context.arguments, [
    {kind: "operator", type: "select", expected: "property acces chain"}
  ]);

  return ctx => {
    if (context.target == "aggregation") {
      const parsedArguments = parseArguments(context.arguments, ctx, convert);

      const propertyName: string = parsedArguments[0];
      // we can not use $exists since it is a query operator which we can't use as an logical operator
      // so we use a clever trick to see if "type number" of the field is greater than "null's" type number
      // https://docs.mongodb.com/manual/reference/bson-types/#bson-types-comparison-order
      return {$expr: {$gt: [propertyName, null]}};
    } else {
      const parsedArguments = parseArguments(context.arguments, ctx, compile);

      const documentValue = parsedArguments[0];

      return typeof documentValue != "undefined";
    }
  };
};

export const some: func.Func = context => {
  const fnName = "some";
  validateArgumentsLength(fnName, context.arguments, undefined, 2);
  validateArgumentsNode(fnName, context.arguments, [
    {kind: "operator", type: "select", expected: "property acces chain"},
    ...(new Array(context.arguments.length - 1).fill({
      kind: "literal",
      expected: "literal"
    }) as any)
  ]);

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
  const fnName = "every";
  validateArgumentsLength("every", context.arguments, undefined, 2);
  validateArgumentsNode(fnName, context.arguments, [
    {kind: "operator", type: "select", expected: "property acces chain"},
    new Array(context.arguments.length - 1).fill({kind: "literal", expected: "literal"}) as any
  ]);

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
  const fnName = "equal";
  validateArgumentsLength(fnName, context.arguments, undefined, 2);
  validateArgumentsNode(fnName, context.arguments, [
    {kind: "operator", type: "select", expected: "property acces chain"},
    new Array(context.arguments.length - 1).fill({kind: "literal", expected: "literal"}) as any
  ]);

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
  const fnName = "regex";
  validateArgumentsLength(fnName, context.arguments, undefined, 2, 3);
  validateArgumentsNode(fnName, context.arguments, [
    {kind: "operator", type: "select", expected: "property acces chain"},
    new Array(context.arguments.length - 1).fill({kind: "literal", expected: "literal"}) as any
  ]);

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

function validateArgumentsLength(
  fnName: string,
  args: any[],
  exactLength: number = 0,
  minLength: number = 0,
  maxLength: number = 0
) {
  const messages: string[] = [];

  if (exactLength && args.length != exactLength) {
    messages.push(
      `Function '${fnName}' accepts exactly ${exactLength} argument(s) but found ${args.length}.`
    );
  }

  if (minLength && args.length < minLength) {
    messages.push(
      `Function '${fnName}' accepts minimum ${minLength} argument(s) but found ${args.length}.`
    );
  }

  if (maxLength && args.length > maxLength) {
    messages.push(
      `Function '${fnName}' accepts maximum ${maxLength} argument(s) but found ${args.length}.`
    );
  }

  if (messages.length) {
    throw new TypeError(messages.join("\n"));
  }
}

function validateArgumentsNode(
  fnName: string,
  args: any[],
  argumentsInfo: {kind: string; type?: string; expected: string}[]
) {
  const messages: string[] = [];
  for (const [index, node] of args.entries()) {
    if (
      argumentsInfo[index].kind != node.kind ||
      (argumentsInfo[index].type && argumentsInfo[index].type != node.type)
    ) {
      messages.push(
        `Function '${fnName}' arg[${index}] must be a ${argumentsInfo[index].expected}.`
      );
    }
  }

  if (messages.length) {
    throw new TypeError(messages.join("\n"));
  }
}
