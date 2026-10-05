import {HttpException, PipeTransform} from "@nestjs/common";

/**
 * An pipe converts string to number
 * If the value is falsy 0 will be returned as default.
 */
export const NUMBER: PipeTransform<string, number> = {
  transform: value => {
    return Number(value || 0);
  }
};

export const JSONP: PipeTransform<string, object> = {
  transform: value => {
    if (typeof value == "string") {
      try {
        return JSON.parse(value);
      } catch (error) {
        throw new HttpException(error.message, 400);
      }
    }
    return value;
  }
};

export function JSONPR(reviver?: (key: string, value: any) => any): PipeTransform<string, object> {
  return {
    transform: value => {
      if (typeof value == "string") {
        try {
          return JSON.parse(value, reviver);
        } catch (error) {
          throw new HttpException(error.message, 400);
        }
      }
      return value;
    }
  };
}

/**
 * Tells a Mongo JSON filter from an expression, for the `OR(...)` in front of a `filter` query parameter.
 *
 * A leading `{` is the whole test: the expression language has no literal that starts with one, so the
 * two surfaces cannot collide. It lives here rather than next to the bucket filters because nine
 * management endpoints use it now, and only one of them is a bucket endpoint.
 */
export function isJSONFilter(value: any): boolean {
  if (typeof value == "string" && value.trim().length) {
    return value.trim()[0] == "{";
  }
  return false;
}

export function EXPRESSION(parse: (value: string) => any): PipeTransform<string, string> {
  return {
    transform: value => {
      if (typeof value == "string") {
        try {
          return parse(value);
        } catch (error) {
          throw new HttpException(error.message, 400);
        }
      }
      return value;
    }
  };
}

export function DEFAULT<T = unknown>(defaultValue: T | (() => T)): PipeTransform<any, T> {
  return {
    transform: value => {
      return typeof value == "undefined"
        ? typeof defaultValue == "function"
          ? (defaultValue as Function)()
          : defaultValue
        : value;
    }
  };
}

export const BOOLEAN: PipeTransform<string, boolean> = {
  transform: value => {
    return /true|1/i.test(value);
  }
};

export const DATE: PipeTransform<string, Date> = {
  transform: value => {
    return new Date(value);
  }
};

export function ARRAY<T>(coerce: (v: string) => T): PipeTransform<string | string[], T[]> {
  return {
    transform: value => {
      if (!Array.isArray(value)) {
        value = value ? [value] : [];
      }
      return value.map(coerce);
    }
  };
}

export function BooleanCheck(value) {
  return (
    value == "true" ||
    value == "false" ||
    //compatibility with default values
    value === true ||
    value === false
  );
}

export function OR(
  condition: (value) => boolean,
  coerceTrue: PipeTransform,
  coerceFalse?: PipeTransform
): PipeTransform {
  return {
    transform: value => {
      if (condition(value)) {
        return coerceTrue.transform(value, undefined);
      } else if (coerceFalse) {
        return coerceFalse.transform(value, undefined);
      }
      return value;
    }
  };
}
