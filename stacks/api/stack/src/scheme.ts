import {ResourceDefinition} from "./definition";

export interface GroupResource {
  group: string;
  resource: string;
}

export interface Scheme {
  definition: ResourceDefinition;
  conversion?: ConversionFunc[];
  prepareForUpdate?: () => void;
  prepareForCreate?: () => void;
}

export type ConversionFunc = (first: unknown, second: unknown) => void;

const schemes: Scheme[] = [];

export function register(scheme: Scheme) {
  schemes.push(scheme);
}

export function findSchemeByGroupAndResource(groupResource: GroupResource) {
  for (const scheme of schemes) {
    if (scheme.definition.group == groupResource.group && scheme.definition.names.plural == groupResource.resource) {
      return scheme;
    }
  }
}

export function makeKey(groupResource: GroupResource): string {
  return `${groupResource.group}/${groupResource.resource}`;
}

// export function isVersionRegistered(version: string): boolean {
//     for (const observedVersion of observedVersions) {
//         if ( observedVersion.version == version ) {
//             return true;
//         }
//     }
//     return false;
// }

// export function isGroupRegistered(group: string): boolean {
//     for (const observedVersion of observedVersions) {
//         if ( observedVersion.group == group ) {
//             return true;
//         }
//     }
//     return false;
// }
