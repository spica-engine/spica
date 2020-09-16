import {JSONSchema7} from "json-schema";

export interface TypeMeta {
  kind: string;
  apiVersion: string;
}

export interface ObjectMeta {
  metadata: {
    name: string;
  };
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
  shortnames: string[];
}

export interface ResourceDefinitionVersion {
  name: string;
  schema: JSONSchema7;
  additionalPrinterColumns?: AdditionalPrinterColumn[];
}

export interface AdditionalPrinterColumn {
  name: string;
  type: string;
  description: string;
  jsonPath: string;
}
