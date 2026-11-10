import {ids} from "@spica-server/data";
import {Id} from "@spica-server/interface-data";

type KeyedBucket = {primary?: string};

export const documentKeyField = (bucket: KeyedBucket): string => ids().keyField(bucket);

export const documentKey = (bucket: KeyedBucket, document: object): Id =>
  document[documentKeyField(bucket)];

export const withDocumentKey = <T extends object>(
  bucket: KeyedBucket,
  document: T,
  key: Id | string
) => ({
  ...document,
  [documentKeyField(bucket)]: key
});
