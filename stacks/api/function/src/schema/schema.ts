import {JSONSchema7} from "json-schema";

export type Schema = JSONSchema7 | (() => Promise<JSONSchema7>);

export type SchemaWithName = {name: string; schema: Schema};

export const SCHEMA = "SCHEMA";
