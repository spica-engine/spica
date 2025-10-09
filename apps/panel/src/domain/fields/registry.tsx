/**
 * Field Registry
 * ------------------------------------------------------------
 * Central access to field definitions. Each definition encapsulates
 * defaults, property construction, parsing, formatting and validation.
 */

import {type FieldDefinition, type FieldFormState, FieldKind} from "./types";
import {ARRAY_DEFINITION} from "./definitions/array";
import {BOOLEAN_DEFINITION} from "./definitions/boolean";
import {COLOR_DEFINITION} from "./definitions/color";
import {DATE_DEFINITION} from "./definitions/date";
import {FILE_DEFINITION} from "./definitions/file";
import {JSON_DEFINITION} from "./definitions/json";
import {LOCATION_DEFINITION} from "./definitions/location";
import {NUMBER_DEFINITION} from "./definitions/number";
import {OBJECT_DEFINITION} from "./definitions/object";
import {RELATION_DEFINITION} from "./definitions/relation";
import {RICHTEXT_DEFINITION} from "./definitions/richtext";
import {MULTISELECT_DEFINITION} from "./definitions/select";
import {STRING_DEFINITION} from "./definitions/string";
import {TEXTAREA_DEFINITION} from "./definitions/textarea";
import type {Property} from "../../services/bucketService";

export function resolveFieldKind(input: string): FieldKind | undefined {
  if (!input) return undefined;
  if ((Object.values(FieldKind) as string[]).includes(input)) return input as FieldKind;
  return SYNONYM_MAP[input.toLowerCase()];
}

export function buildBaseProperty(values: FieldFormState): Property {
  const {fieldValues, configurationValues, type, innerFields} = values;
  return {
    type,
    title: fieldValues.title,
    description: fieldValues.description || undefined,
    options: {
      position: "bottom",
      index: configurationValues.index || undefined,
      unique: configurationValues.uniqueValues || undefined,
      translate: configurationValues.translate || undefined
    },
    required:
      innerFields && innerFields.length > 0
        ? innerFields
            .filter(i => i.configurationValues.requiredField)
            ?.map?.(i => i.fieldValues.title)
        : undefined
  } as Property;
}

export const FIELD_REGISTRY: Partial<Record<FieldKind, FieldDefinition>> = {
  [FieldKind.String]: STRING_DEFINITION,
  [FieldKind.Number]: NUMBER_DEFINITION,
  [FieldKind.Boolean]: BOOLEAN_DEFINITION,
  [FieldKind.Date]: DATE_DEFINITION,
  [FieldKind.Textarea]: TEXTAREA_DEFINITION,
  [FieldKind.Multiselect]: MULTISELECT_DEFINITION,
  [FieldKind.Relation]: RELATION_DEFINITION,
  [FieldKind.Location]: LOCATION_DEFINITION,
  [FieldKind.Array]: ARRAY_DEFINITION,
  [FieldKind.Object]: OBJECT_DEFINITION,
  [FieldKind.File]: FILE_DEFINITION,
  [FieldKind.Richtext]: RICHTEXT_DEFINITION,
  [FieldKind.Json]: JSON_DEFINITION,
  [FieldKind.Color]: COLOR_DEFINITION
};

const SYNONYM_MAP: Record<string, FieldKind> = Object.values(FIELD_REGISTRY).reduce(
  (acc, def) => {
    if (!def) return acc;
    acc[def.display.label.toLowerCase()] = def.kind;
    return acc;
  },
  {} as Record<string, FieldKind>
);
