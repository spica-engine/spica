import {IdTypes} from "@spica-server/interface-data";

let boundIdTypes: IdTypes | undefined;

export function bindIdTypes(idTypes: IdTypes) {
  boundIdTypes = idTypes;
}

export function ids(): IdTypes {
  if (!boundIdTypes) {
    throw new Error("No data adapter is bound. Register one with DataModule.forRoot().");
  }
  return boundIdTypes;
}
