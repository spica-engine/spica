import {
  initialize as _initialize,
  checkInitialized,
  HttpService,
  isPlatformBrowser
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

let req: HttpService;

export function initialize(options: ApikeyInitialization | IdentityInitialization) {
  const {authorization: _authorization, publicUrl} = _initialize(options);

  authorization = _authorization;

  req = new HttpService(
    {
      baseURL: publicUrl,
      headers: {
        Authorization: authorization
      }
    },
    {
      headers: {
        "Content-Type": "application/bson"
      }
    }
  );
}

// /Users/tuna/Desktop/functions

export async function insert(
  object: File | BufferWithMeta,
  onUploadProgress?: (progress: ProgressEvent) => void
) {
  checkInitialized(authorization);
  const body = await preparePostBody([object]);

  return req.post<StorageObject>("/storage", body, {
    onUploadProgress
  });
}

export async function insertMany(
  objects: FileList | (File | BufferWithMeta)[],
  onUploadProgress?: (progress: ProgressEvent) => void
): Promise<StorageObject[]> {
  checkInitialized(authorization);

  const body = await preparePostBody(objects);

  return req.post<StorageObject[]>("/storage", body, {
    onUploadProgress
  });
}

export function get(id: string) {
  checkInitialized(authorization);

  return req.get<StorageObject>(`/storage/${id}`);
}

export function download(
  id: string,
  headers?: any,
  onDownloadProgress?: (progress: ProgressEvent) => void
) {
  checkInitialized(authorization);

  return req.get<Blob | NodeJS.ReadableStream>(`/storage/${id}/view`, {
    headers,
    onDownloadProgress,
    responseType: isPlatformBrowser() ? "blob" : "stream"
  });
}

export function getAll(queryParams?: {limit?: number; skip?: number; sort?: object}) {
  checkInitialized(authorization);

  return req.get<IndexResult<StorageObject>>(`/storage`, {
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

  return req.put<StorageObject>(`/storage/${id}`, body, {
    onUploadProgress
  });
}

export function remove(id: string) {
  checkInitialized(authorization);

  return req.delete(`/storage/${id}`);
}
