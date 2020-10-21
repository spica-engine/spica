import {Action, Command, CreateCommandParameters} from "@caporal/core";
import {JSONSchema7} from "json-schema";
import {request} from "../request";

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
  spec: SpecType;
  status?: unknown;
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

async function apiResources() {
  const resources = await request.get<ResourceDefinition[]>("http://localhost:4300/apis");
  console.table(
    resources.map(def => {
      return {
        name: def.names.plural,
        shortnames: def.names.shortnames.join(","),
        apigroup: def.group,
        namespaced: false,
        kind: def.names.kind,
        versions: def.versions.map(v => v.name).join(", ")
      };
    })
  );
}

export default function({createCommand}: CreateCommandParameters): Command {
  return createCommand("Print the supported API resources on the server.").action(
    (apiResources as unknown) as Action
  );
}
