import {JSONSchema7} from "json-schema";

export interface TypeMeta {
  kind: string;
  apiVersion: string;
}

export interface ObjectMeta {
  metadata: {
    name: string;
    creationTimestamp: string;
  };
}

export interface Resource<SpecType = unknown, StatusType = unknown> extends TypeMeta, ObjectMeta {
  spec: SpecType,
  status?: StatusType
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
  additionalPrinterColumns?: AdditionalPrinterColumn[];
}

export interface AdditionalPrinterColumn {
  name: string;
  type: string;
  description: string;
  jsonPath: string;
}