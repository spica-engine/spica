import {Operator, Validator} from "@spica-server/interface/asset";

export const validators = new Map<string, Validator[]>();
export const operators = new Map<string, Operator[]>();

export namespace registrar {
  export function validator(_module: string, validator: Validator) {
    const existingValidators = validators.get(_module) || [];
    validators.set(_module, existingValidators.concat(validator));
  }
  export function operator(_module: string, operator: Operator) {
    const existingOperators = operators.get(_module) || [];
    operators.set(_module, existingOperators.concat(operator));
  }
}
