import {ObjectId} from "../../../database";

export interface StorageObject<DataType> {
  _id?: string | ObjectId;
  name: string;
  url?: string;
  content: StorageObjectContent<DataType>;
}

interface StorageObjectContent<DataType> {
  data: DataType;
  type: string;
  size?: number;
}

type StorageObjectContentMeta = Omit<StorageObjectContent<any>, "data">;

export type StorageObjectMeta = Omit<StorageObject<any>, "content"> & {
  content: StorageObjectContentMeta;
};

export interface BsonArray {
  content: StorageObject<Buffer>[];
}

export type JsonArray = StorageObject<Buffer>[];

export type MultipartFormData = Express.Multer.File;

export type MixedBody = BsonArray | JsonArray | MultipartFormData[];

export interface IBodyConverter<I, O> {
  validate: (body: unknown) => boolean;
  convert: (body: I) => O;
}
