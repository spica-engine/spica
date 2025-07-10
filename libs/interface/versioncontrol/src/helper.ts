import {ChangeTypes, DocChange} from "./synchronizer";

export function getIdForDocToRepConverter(change: DocChange, displayableName: string): string {
  const originalId = change.resource._id.toString();
  let _id = `${displayableName}(${originalId})`;

  if (change.changeType == ChangeTypes.DELETE) {
    _id = originalId;
  }

  return _id;
}
