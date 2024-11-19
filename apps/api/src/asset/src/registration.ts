import {Exporter, Operator, ResourceLister, Validator} from "@spica/interface";

export const validators = new Map<string, Validator[]>();
export const operators = new Map<string, Operator[]>();
export const exporters = new Map<string, Exporter[]>();
export const listers = new Map<string, ResourceLister[]>();

export namespace registrar {
  export function validator(_module: string, validator: Validator) {
    const existingValidators = validators.get(_module) || [];
    validators.set(_module, existingValidators.concat(validator));
  }

  export function operator(_module: string, operator: Operator) {
    const existingOperators = operators.get(_module) || [];
    operators.set(_module, existingOperators.concat(operator));
  }

  export function exporter(_module: string, exporter: Exporter) {
    const existingExporters = exporters.get(_module) || [];
    exporters.set(_module, existingExporters.concat(exporter));
  }
}
