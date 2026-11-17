import {BadRequestException} from "@nestjs/common";
import {conditionPaths, FilterCondition, FilterNode} from "@spica-server/interface-bucket-common";

type Node = any;

const COMPARISONS: Record<string, string> = {
  eq: "==",
  ne: "!=",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<="
};

const identifier = (name: string): Node => ({kind: "identifier", name});

const field = (path: string[]): Node =>
  path.reduce(
    (left: Node, name) => ({
      kind: "operator",
      type: "select",
      category: "binary",
      left,
      right: identifier(name)
    }),
    identifier("document")
  );

function literal(value: unknown): Node {
  if (value === null || value === undefined) {
    return {kind: "literal", type: "null", value: null};
  }
  if (typeof value == "string" || value instanceof Date) {
    return {kind: "literal", type: "string", value};
  }
  if (typeof value == "boolean") {
    return {kind: "literal", type: "bool", value};
  }
  if (typeof value == "number") {
    return {kind: "literal", type: Number.isInteger(value) ? "int" : "double", value};
  }
  throw new BadRequestException("A value in the query has to be a string, number or boolean.");
}

const binary = (type: string, left: Node, right: Node): Node => ({
  kind: "operator",
  type,
  category: "binary",
  left,
  right
});

function condition({path, operator, value}: FilterCondition): Node {
  const left = field(path);
  if (operator in COMPARISONS) {
    return binary(COMPARISONS[operator], left, literal(value));
  }
  if (operator == "in" || operator == "nin") {
    if (!Array.isArray(value)) {
      throw new BadRequestException(`"${operator}" needs a list of values.`);
    }
    const member = binary("in", left, value.map(literal));
    return operator == "in" ? member : {kind: "unary", type: "not", member};
  }
  if (operator == "regex") {
    if (typeof value != "string") {
      throw new BadRequestException('"regex" needs a string.');
    }
    return {kind: "call", left: identifier("regex"), arguments: [left, literal(value)]};
  }
  throw new BadRequestException(`The operator "${operator}" is not supported on PostgreSQL.`);
}

export function expressionOf(node: FilterNode): Node {
  if ("and" in node || "or" in node) {
    const [first, ...rest] = ("and" in node ? node.and : node.or).map(expressionOf);
    return rest.reduce((all, next) => binary("and" in node ? "and" : "or", all, next), first);
  }
  return condition(node);
}

export const wherePaths = (node: FilterNode) => conditionPaths(node);
