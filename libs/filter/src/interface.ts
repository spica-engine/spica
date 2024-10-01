export interface Extractor {
  operators: string[];
  factory: (expression: Expression) => string[][];
}

export interface Expression {
  [key: string]: any;
}

export type KeyValidator = (key: string) => boolean;
export type ValueConstructor<NewType = any> = (val) => NewType;
