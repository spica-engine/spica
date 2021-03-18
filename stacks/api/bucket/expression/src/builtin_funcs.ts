import * as func from "./func";
import {convert} from "./convert";
import {compile} from "./compile";

interface ArgumentValidation {
  validator: (node) => boolean;
  mustBe: string;
}

export const PropertyAccesChainValidation: ArgumentValidation = {
  validator: node => {
    if (node.kind != "operator" || node.type != "select") {
      return false;
    }
    return true;
  },
  mustBe: "property access chain"
};

export const LiteralValidation: ArgumentValidation = {
  validator: node => {
    if (node.kind != "literal") {
      return false;
    }
    return true;
  },
  mustBe: "literal"
};

export const ArrayValidation: ArgumentValidation = {
  validator: node => {
    if (!Array.isArray(node)) {
      return false;
    }
    return true;
  },
  mustBe: "array"
};

export const has: func.Func = context => {
  const fnName = "has";

  validateArgumentsLength(fnName, context.arguments, 1);

  const argValidation = PropertyAccesChainValidation;

  validateArgumentsOrder(fnName, context.arguments, [argValidation]);

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

export const unixTime: func.Func = context => {
  const fnName = "unixTime";

  validateArgumentsLength(fnName, context.arguments, 1);

  const argValidation = PropertyAccesChainValidation;
  validateArgumentsOrder(fnName, context.arguments, [argValidation]);

  return ctx => {
    if (context.target == "aggregation") {
      const parsedArguments = parseArguments(context.arguments, ctx, convert);

      const propertyName: string = parsedArguments[0];

      return {
        $divide: [
          {
            $toLong: propertyName
          },
          1000
        ]
      };
    } else {
      const parsedArguments = parseArguments(context.arguments, ctx, compile);

      const documentValue = parsedArguments[0];

      return new Date(documentValue).getTime() / 1000;
    }
  };
};

export const now: func.Func = context => {
  const fnName = "now";

  validateArgumentsLength(fnName, context.arguments, 0);

  return () => {
    if (context.target == "aggregation") {
      return {
        $divide: [
          {
            $toLong: Date.now()
          },
          1000
        ]
      };
    } else {
      return Date.now() / 1000;
    }
  };
};

export const some: func.Func = context => {
  const fnName = "some";

  validateArgumentsLength(fnName, context.arguments, 2);

  const argValidations: ArgumentValidation[] = [
    {
      validator: node => {
        return PropertyAccesChainValidation.validator(node) || ArrayValidation.validator(node);
      },
      mustBe: "property access chain or array"
    },
    {
      validator: node => {
        return PropertyAccesChainValidation.validator(node) || ArrayValidation.validator(node);
      },
      mustBe: "property access chain or array"
    }
  ];

  validateArgumentsOrder(fnName, context.arguments, argValidations);

  return ctx => {
    if (context.target == "aggregation") {
      const parsedArguments = parseArguments(context.arguments, ctx, convert);

      const propertyName: string = parsedArguments[0];
      const compare: unknown[] = parsedArguments[1];

      return createInQuery(compare, propertyName, "$or");
    } else {
      const parsedArguments = parseArguments(context.arguments, ctx, compile);

      const target: unknown[] = parsedArguments[0];
      const compare: unknown[] = parsedArguments[1];

      if (!Array.isArray(target) || !Array.isArray(compare)) {
        return false;
      }

      return compare.some(item => target.includes(item));
    }
  };
};

export const every: func.Func = context => {
  const fnName = "every";
  validateArgumentsLength(fnName, context.arguments, 2);

  const argValidations: ArgumentValidation[] = [
    {
      validator: node => {
        return PropertyAccesChainValidation.validator(node) || ArrayValidation.validator(node);
      },
      mustBe: "property access chain or array"
    },
    {
      validator: node => {
        return PropertyAccesChainValidation.validator(node) || ArrayValidation.validator(node);
      },
      mustBe: "property access chain or array"
    }
  ];

  validateArgumentsOrder(fnName, context.arguments, argValidations);

  return ctx => {
    if (context.target == "aggregation") {
      const parsedArguments = parseArguments(context.arguments, ctx, convert);

      const propertyName: string = parsedArguments[0];
      const compare: unknown[] = parsedArguments[1];

      return createInQuery(compare, propertyName, "$and");
    } else {
      const parsedArguments = parseArguments(context.arguments, ctx, compile);

      const target: unknown[] = parsedArguments[0];
      const compare: unknown[] = parsedArguments[1];

      if (!Array.isArray(target) || !Array.isArray(compare)) {
        return false;
      }

      return compare.every(item => target.includes(item));
    }
  };
};

export const equal: func.Func = context => {
  const fnName = "equal";
  validateArgumentsLength(fnName, context.arguments, 2);

  const argValidations: ArgumentValidation[] = [
    {
      validator: node => {
        return PropertyAccesChainValidation.validator(node) || ArrayValidation.validator(node);
      },
      mustBe: "property access chain or array"
    },
    {
      validator: node => {
        return PropertyAccesChainValidation.validator(node) || ArrayValidation.validator(node);
      },
      mustBe: "property access chain or array"
    }
  ];

  validateArgumentsOrder(fnName, context.arguments, argValidations);

  return ctx => {
    if (context.target == "aggregation") {
      const parsedArguments = parseArguments(context.arguments, ctx, convert);

      const propertyName: string = parsedArguments[0];
      const compare: unknown[] = parsedArguments[1];

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
                compare.length
              ]
            },
            {
              $eq: [
                {
                  $setDifference: [propertyName, compare]
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

      const target: unknown[] = parsedArguments[0];
      const compare: unknown[] = parsedArguments[1];

      if (!Array.isArray(target) || !Array.isArray(compare)) {
        return false;
      }

      return target.length == compare.length && compare.every(item => target.includes(item));
    }
  };
};

export const regex: func.Func = context => {
  const fnName = "regex";
  validateArgumentsLength(fnName, context.arguments, undefined, 2, 3);

  const argValidations = [PropertyAccesChainValidation];

  argValidations.push(...new Array(context.arguments.length - 1).fill(LiteralValidation));

  validateArgumentsOrder(fnName, context.arguments, argValidations);

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

export function createInQuery(items: unknown[], propertyName: string, operator: "$and" | "$or") {
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

export function validateArgumentsLength(
  fnName: string,
  args: any[],
  exactLength?: number,
  minLength?: number,
  maxLength?: number
) {
  if (exactLength != undefined && args.length != exactLength) {
    throw new TypeError(
      `Function '${fnName}' accepts exactly ${exactLength} argument(s) but found ${args.length}.`
    );
  }

  if (minLength != undefined && args.length < minLength) {
    throw new TypeError(
      `Function '${fnName}' accepts minimum ${minLength} argument(s) but found ${args.length}.`
    );
  }

  if (maxLength != undefined && args.length > maxLength) {
    throw new TypeError(
      `Function '${fnName}' accepts maximum ${maxLength} argument(s) but found ${args.length}.`
    );
  }
}

export function validateArgumentsOrder(
  fnName: string,
  args: any[],
  argumentsInfo: ArgumentValidation[]
) {
  const messages: string[] = [];
  for (const [index, node] of args.entries()) {
    if (!argumentsInfo[index].validator(node)) {
      messages.push(`Function '${fnName}' arg[${index}] must be ${argumentsInfo[index].mustBe}.`);
    }
  }

  if (messages.length) {
    throw new TypeError(messages.join("\n"));
  }
}
