interface InitializeOptions {
  publicUrl?: string;
}

export interface ApikeyInitialization extends InitializeOptions {
  apikey: string;
}

export interface IdentityInitialization extends InitializeOptions {
  identity: string;
}

export interface InitializationResult {
  authorization: string;
  publicUrl: string;
}

export interface IndexResult<T> {
  meta: {
    total: number;
  };
  data: T[];
}

export interface StorageObject {
  _id: string;
  name: string;
  url: string;
  content: {
    type: string;
    size: number;
  };
}

type Base64 = string;

export interface Base64WithMeta {
  data: Base64;
  name: string;
  contentType: string;
}

export function instanceOfBase64WithMeta(value: any): value is Base64WithMeta {
  return "data" in value && "name" in value && "contentType" in value;
}

export function isValidBase64(value: string) {
  return /^(?:[A-Za-z0-9+\/]{4})*(?:[A-Za-z0-9+\/]{2}==|[A-Za-z0-9+\/]{3}=)?$/.test(value);
}

export const INVALIDBASE64 =
  "Invalid encoded content. Please ensure that content encoded with base64";
