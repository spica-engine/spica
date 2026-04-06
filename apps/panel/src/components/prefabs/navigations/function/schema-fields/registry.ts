import type {SchemaFieldRenderer} from "./types";
import {booleanFieldRenderer} from "./BooleanField";
import {numberFieldRenderer} from "./NumberField";
import {arrayEnumFieldRenderer} from "./ArrayEnumField";
import {arrayObjectFieldRenderer} from "./ArrayObjectField";
import {objectFieldRenderer} from "./ObjectField";
import {enumFieldRenderer} from "./EnumField";
import {textFieldRenderer} from "./TextField";

const fieldRenderers: SchemaFieldRenderer[] = [
  booleanFieldRenderer,
  numberFieldRenderer,
  arrayEnumFieldRenderer,
  arrayObjectFieldRenderer,
  objectFieldRenderer,
  enumFieldRenderer,
  textFieldRenderer
];

export function resolveRenderer(schema: Record<string, any>): SchemaFieldRenderer {
  return fieldRenderers.find(r => r.match(schema)) ?? textFieldRenderer;
}

export function registerRenderer(renderer: SchemaFieldRenderer, position?: number): void {
  const insertAt = position ?? fieldRenderers.length - 1;
  fieldRenderers.splice(insertAt, 0, renderer);
}
