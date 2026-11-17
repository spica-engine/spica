import {Bucket} from "@spica-server/interface-bucket";
import {ColumnType} from "../../schema/metadata/types.js";

export type Scalar = string | number | boolean | Date | null;

export type Property = NonNullable<Bucket["properties"]>[string];

export interface Constant {
  kind: "constant";
  value: Scalar;
  literal: boolean;
}

export interface Column {
  kind: "column";
  sql: string;
  type: ColumnType;
  property: Property;
}

export interface Expression {
  kind: "expression";
  sql: string;
  type: ColumnType;
  twoValued: boolean;
}

export type Operand = Constant | Column | Expression;

export const constant = (value: Scalar, literal = false): Constant => ({
  kind: "constant",
  value,
  literal
});

export const isNull = (operand: Operand) => operand.kind == "constant" && operand.value === null;
