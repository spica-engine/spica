import {ResolvedColumn} from "./entity.js";

type Render = (column: string, spec: ResolvedColumn, values: unknown[]) => string;

export class Condition {
  constructor(private readonly render: Render) {}

  sql(column: string, spec: ResolvedColumn, values: unknown[]) {
    return this.render(column, spec, values);
  }
}

export class Assignment {
  constructor(private readonly render: Render) {}

  sql(column: string, spec: ResolvedColumn, values: unknown[]) {
    return this.render(column, spec, values);
  }
}

export class WhereGroup {
  constructor(
    readonly operator: "AND" | "OR",
    readonly parts: Where[]
  ) {}
}

export type Where = Record<string, unknown> | WhereGroup;

export function isUnconditional(where: Where) {
  return where instanceof WhereGroup
    ? where.operator == "AND" && !where.parts.length
    : !Object.keys(where).length;
}

export class Aggregation {
  constructor(readonly property: string) {}
}

const bind = (values: unknown[], value: unknown) => `$${values.push(value)}`;

function elementType(spec: ResolvedColumn) {
  if (!spec.type.endsWith("[]")) {
    throw new Error(`"${spec.property}" is not an array column.`);
  }
  return spec.type.slice(0, -2);
}

function requireJsonb(spec: ResolvedColumn) {
  if (spec.type != "jsonb") {
    throw new Error(`"${spec.property}" is not a jsonb column.`);
  }
}

const comparison = (operator: string, value: unknown) =>
  new Condition((column, _, values) => `${column} ${operator} ${bind(values, value)}`);

export const isNotNull = () => new Condition(column => `${column} IS NOT NULL`);

export const notEquals = (value: unknown) => comparison("<>", value);

export const gte = (value: unknown) => comparison(">=", value);

export const lt = (value: unknown) => comparison("<", value);

export const range = (from: unknown, to: unknown) =>
  new Condition(
    (column, _, values) =>
      `(${column} >= ${bind(values, from)} AND ${column} < ${bind(values, to)})`
  );

export const has = (value: unknown) =>
  new Condition(
    (column, spec, values) => `${bind(values, value)}::${elementType(spec)} = ANY(${column})`
  );

export const startsWith = (prefix: string) =>
  new Condition((column, _, values) => `starts_with(${column}, ${bind(values, prefix)})`);

export const matches = (pattern: string) => comparison("~", pattern);

export const notMatches = (pattern: string) => comparison("!~", pattern);

export const and = (...parts: Where[]) => new WhereGroup("AND", parts);

export const or = (...parts: Where[]) => new WhereGroup("OR", parts);

export const addToSet = (value: unknown) =>
  new Assignment((column, spec, values) => {
    const placeholder = `${bind(values, value)}::${elementType(spec)}`;
    return `CASE WHEN ${placeholder} = ANY(${column}) THEN ${column} ELSE array_append(${column}, ${placeholder}) END`;
  });

export const pull = (value: unknown) =>
  new Assignment(
    (column, spec, values) =>
      `array_remove(${column}, ${bind(values, value)}::${elementType(spec)})`
  );

export const increment = (amount: number) =>
  new Assignment((column, _, values) => `COALESCE(${column}, 0) + ${bind(values, amount)}`);

export const replacePrefix = (from: string, to: string) =>
  new Assignment((column, _, values) => {
    const fromPlaceholder = bind(values, from);
    return `${bind(values, to)} || substr(${column}, char_length(${fromPlaceholder}) + 1)`;
  });

export const jsonbSet = (entries: Record<string, unknown>) =>
  new Assignment((column, spec, values) => {
    requireJsonb(spec);
    return Object.entries(entries).reduce(
      (expression, [path, value]) =>
        `jsonb_set(${expression}, ${bind(values, path.split("."))}::text[], ${bind(values, JSON.stringify(value))}::jsonb, true)`,
      `COALESCE(${column}, '{}'::jsonb)`
    );
  });

export const jsonbMerge = (entries: Record<string, unknown>) =>
  new Assignment((column, spec, values) => {
    requireJsonb(spec);
    return `COALESCE(${column}, '{}'::jsonb) || ${bind(values, JSON.stringify(entries))}::jsonb`;
  });

export const jsonbRemove = (paths: string[]) =>
  new Assignment((column, spec, values) => {
    requireJsonb(spec);
    return paths.reduce(
      (expression, path) => `(${expression} #- ${bind(values, path.split("."))}::text[])`,
      column
    );
  });

export const sum = (property: string) => new Aggregation(property);
