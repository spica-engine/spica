import {
  initialize as _initialize,
  checkInitialized,
  isPlatformBrowser,
  HttpService
} from "@spica-devkit/internal_common";
import {
  StorageObject,
  BufferWithMeta,
  IndexResult,
  ApikeyInitialization,
  IdentityInitialization
} from "./interface";
import {preparePostBody, preparePutBody} from "./utility";

let authorization;

let service: HttpService;

export function initialize(options: ApikeyInitialization | IdentityInitialization) {
  const {authorization: _authorization, publicUrl, service: _service} = _initialize(options);

  authorization = _authorization;

  service = _service;

  service.setWriteDefaults({
    headers: {
      "Content-Type": "application/bson"
    }
  });
}

// /Users/tuna/Desktop/functions

export async function insert(
  object: File | BufferWithMeta,
  onUploadProgress?: (progress: ProgressEvent) => void
) {
  checkInitialized(authorization);
  const body = await preparePostBody([object]);

  return service.post<StorageObject>("/storage", body, {
    onUploadProgress
  });
}

export async function insertMany(
  objects: FileList | (File | BufferWithMeta)[],
  onUploadProgress?: (progress: ProgressEvent) => void
): Promise<StorageObject[]> {
  checkInitialized(authorization);

  const body = await preparePostBody(objects);

  return service.post<StorageObject[]>("/storage", body, {
    onUploadProgress
  });
}

export function get(id: string) {
  checkInitialized(authorization);

  return service.get<StorageObject>(`/storage/${id}`);
}

export function download(
  id: string,
  headers?: any,
  onDownloadProgress?: (progress: ProgressEvent) => void
) {
  checkInitialized(authorization);

  return service.get<Blob | NodeJS.ReadableStream>(`/storage/${id}/view`, {
    headers,
    onDownloadProgress,
    responseType: isPlatformBrowser() ? "blob" : "stream"
  });
}

export function getAll(queryParams?: {limit?: number; skip?: number; sort?: object}) {
  checkInitialized(authorization);

  return service.get<IndexResult<StorageObject>>(`/storage`, {
    params: queryParams
  });
}

export async function update(
  id: string,
  object: File | BufferWithMeta,
  onUploadProgress?: (progress: ProgressEvent) => void
) {
  checkInitialized(authorization);

  const body = await preparePutBody(object);

  return service.put<StorageObject>(`/storage/${id}`, body, {
    onUploadProgress
  });
}

export function remove(id: string) {
  checkInitialized(authorization);

  return service.delete(`/storage/${id}`);
}
