/**
 * @owner Agent_Frontend
 */

// Inline object/array editors get a popover sized by how deeply their schema
// nests, so a flat {a, b} stays compact while a deeply nested config gets room
// to breathe. width = BASE_X + PER_LEVEL_Y * depth, clamped to the viewport.
export const BASE_X = 300;
export const PER_LEVEL_Y = 90;
export const MIN_WIDTH = BASE_X;
export const MAX_WIDTH = 760;

// A pathological (cyclic) schema would recurse forever; cap the walk depth.
const MAX_RECURSION = 12;

type Schema = {
  type?: string;
  properties?: Record<string, Schema>;
  items?: Schema;
  [key: string]: any;
};

const isComplex = (schema?: Schema | null): schema is Schema =>
  !!schema &&
  (schema.type === "object" ||
    schema.type === "array" ||
    !!schema.properties ||
    !!schema.items);

const childSchemas = (schema: Schema): Schema[] => {
  if (schema.properties) return Object.values(schema.properties);
  if (schema.items) return [schema.items];
  return [];
};

/**
 * Nesting depth of an object/array schema: a flat object = 1, an object whose
 * child is an object = 2, an array of flat objects = 2, and so on. Primitive
 * (non-complex) children add no depth.
 */
export const schemaDepth = (schema?: Schema | null, guard = MAX_RECURSION): number => {
  if (!isComplex(schema) || guard <= 0) return isComplex(schema) ? 1 : 0;

  const nested = childSchemas(schema)
    .filter(isComplex)
    .map(child => schemaDepth(child, guard - 1));

  return 1 + Math.max(0, ...nested);
};

/**
 * Popover width (a CSS length) for an inline complex-cell editor of the given
 * schema. Clamped to a px range and to 90vw so it never overflows the viewport.
 */
export const popoverWidthForSchema = (schema?: Schema | null): string => {
  const raw = BASE_X + PER_LEVEL_Y * schemaDepth(schema);
  const clamped = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, raw));
  return `min(90vw, ${clamped}px)`;
};
