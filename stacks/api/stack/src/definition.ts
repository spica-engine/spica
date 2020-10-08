import {JSONSchema7} from "json-schema";
import { DefinitionInfo } from "typescript";

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

export interface Resource<SpecType = unknown> extends TypeMeta, ObjectMeta {
  spec: SpecType
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


export interface Scheme {
  definition: ResourceDefinition;
  prepareForUpdate(): void;
  prepareForCreate(): void;
}