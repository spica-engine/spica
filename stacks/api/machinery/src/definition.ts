import {JSONSchema7} from "json-schema";

export interface TypeMeta {
  kind: string;
  apiVersion: string;
}

export interface ObjectMeta {
  metadata: {
    name: string;
    package: string;
    creationTimestamp?: string;
    deletionTimestamp?: string;
    uid?: string;
  };
}

export interface Resource<SpecType = unknown, StatusType = unknown> extends TypeMeta, ObjectMeta {
  spec: SpecType;
  status?: StatusType;
}

export interface ResourceDefinition {
  group: string;
  versions: ResourceDefinitionVersion[];
  names: ResourceDefinitionNames;
}

export interface ResourceDefinitionNames {
  plural: string;
  singular: string;
  kind: string;
  shortNames: string[];
}

export interface ResourceDefinitionVersion {
  name: string;
  current: boolean;
  schema: JSONSchema7;
  additionalSchemas?: JSONSchema7[];
  additionalPrinterColumns?: ColumnDefinition[];
}

export interface ColumnDefinition {
  name: string;
  type: "integer" | "number" | "string" | "boolean" | "date";
  description: string;
  jsonPath: string;
  priority?: number;
  format?: "int32" | "int64" | "float" | "double" | "byte" | "date" | "date-time" | "password";
}
