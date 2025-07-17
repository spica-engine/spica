import {ChangeTypes, DocChange} from "./synchronizer";

export function getDisplayableName(change: DocChange, name: string): string | undefined {
  if (change.changeType === ChangeTypes.DELETE) return undefined;
  return `${name}(${change.resource._id.toString()})`;
}
