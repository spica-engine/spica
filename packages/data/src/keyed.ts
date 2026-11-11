import {Id, Keyed} from "@spica-server/interface-data";
import {ids} from "./ids.js";

export const systemKeyField = (): string => ids().systemKeyField();

export const idOf = <T extends object>(record: Keyed<T>): Id => record[systemKeyField()];

export const withId = <T extends object>(record: T, id: Id | string): Keyed<T> =>
  ({...record, [systemKeyField()]: id}) as Keyed<T>;

export const omitId = <T extends object>(record: T | Keyed<T>): T => {
  const copy = {...record};
  delete copy[systemKeyField()];
  return copy as T;
};
