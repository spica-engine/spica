import {Operator, Validator} from "./interface";

export const validators = new Map<string, Validator>();
export const operators = new Map<string, Operator>();

export namespace register {
  export function validator(_module: string, validator: Validator) {
    validators.set(_module, validator);
  }
  export function operator(_module: string, operator: Operator) {
    operators.set(_module, operator);
  }
}
