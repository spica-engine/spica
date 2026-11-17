import {JSONSchema7} from "json-schema";

export type ExtendedJSONSchema7Type =
  | JSONSchema7["type"]
  | "objectid"
  | "uuid"
  | "bigint"
  | "storage"
  | "richtext"
  | "textarea"
  | "color"
  | "multiselect"
  | "relation"
  | "date"
  | "location"
  | "json"
  | "hash"
  | "encrypted";
