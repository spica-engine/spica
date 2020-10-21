import {Conversion} from "./conversion";
import {ResourceDefinition} from "./definition";

export interface GroupResource {
  group: string;
  resource: string;
}

export interface GroupVersion {
  group: string;
  version: string;
}

export interface GroupVersionResource {
  group: string;
  version: string;
  resource: string;
}

export function isGroupVersionResourceEqual(
  first: GroupVersionResource,
  second: GroupVersionResource
): boolean {
  return (
    first.group == second.group &&
    first.version == second.version &&
    first.resource == second.resource
  );
}

export interface Scheme {
  definition: ResourceDefinition;
  conversion?: Conversion[];
  prepareForUpdate?: (object: unknown) => void;
  prepareForCreate?: (object: unknown) => void;
}

const _schemes: Scheme[] = [];

export function register(scheme: Scheme) {
  _schemes.push(scheme);
}

export function schemes(): Scheme[] {
  return _schemes;
}

export function findSchemeByGroupAndResource(groupResource: GroupResource) {
  for (const scheme of _schemes) {
    if (
      scheme.definition.group == groupResource.group &&
      scheme.definition.names.plural == groupResource.resource
    ) {
      return scheme;
    }
  }
}

export function findSchemeByGroupAndVersion(groupVersion: GroupVersion) {
  for (const scheme of _schemes) {
    if (
      scheme.definition.group == groupVersion.group &&
      scheme.definition.versions.findIndex(version => version.name == groupVersion.version) != -1
    ) {
      return scheme;
    }
  }
}

export function findSchemesByGroupAndVersion(groupVersion: GroupVersion) {
  const schemes: Scheme[] = [];
  for (const scheme of _schemes) {
    if (
      scheme.definition.group == groupVersion.group &&
      scheme.definition.versions.findIndex(version => version.name == groupVersion.version) != -1
    ) {
      schemes.push(scheme);
    }
  }
  return schemes;
}

export function findSchemeByGroupAndVersionAndResource(groupVersionResource: GroupVersionResource) {
  for (const scheme of _schemes) {
    if (
      scheme.definition.group == groupVersionResource.group &&
      scheme.definition.names.plural == groupVersionResource.resource &&
      scheme.definition.versions.findIndex(
        version => version.name == groupVersionResource.version
      ) != -1
    ) {
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

export function getVersionFromScheme(scheme: Scheme, versionName: string) {
  return scheme.definition.versions.find(version => version.name == versionName);
}
