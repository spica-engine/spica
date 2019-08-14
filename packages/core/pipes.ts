import {PipeTransform} from "@nestjs/common";

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
      return global.JSON.parse(value);
    }
    return value;
  }
};

export function DEFAULT<T = any>(def: T): PipeTransform<any, T> {
  return {
    transform: value => {
      return typeof value == "undefined" ? def : value;
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
