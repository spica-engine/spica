import {ResourceDefinition} from "./definition";

export interface GroupResource {
  group: string;
  resource: string;
}

export interface GroupVersion {
  group: string;
  version: string;
}

export interface Scheme {
  definition: ResourceDefinition;
  conversion?: ConversionFunc[];
  prepareForUpdate?: (object: unknown) => void;
  prepareForCreate?: (object: unknown) => void;
  lift?: (store: any, object: unknown) => void;
}

export type ConversionFunc = (first: unknown, second: unknown) => void;

const _schemes: Scheme[] = [];

export function register(scheme: Scheme) {
  _schemes.push(scheme);
}

export function schemes(): Scheme[] {
  return _schemes;
}

export function findSchemeByGroupAndResource(groupResource: GroupResource) {
  for (const scheme of _schemes) {
    if (scheme.definition.group == groupResource.group && scheme.definition.names.plural == groupResource.resource) {
      return scheme;
    }
  }
}

export function findSchemeByGroupAndVersion(groupVersion: GroupVersion) {

  for (const scheme of _schemes) {
    if (scheme.definition.group == groupVersion.group && scheme.definition.versions.findIndex(version => version.name == groupVersion.version) != -1) {
      return scheme;
    }
  }
}

export function findSchemeByGroup(group: string) {
  for (const scheme of _schemes) {
    if (scheme.definition.group == group) {
      return scheme;
    }
  }
}


export function makeKey(groupResource: GroupResource): string {
  return `${groupResource.group}/${groupResource.resource}`;
}
