import {
  initialize as _initialize,
  checkInitialized,
  isPlatformBrowser,
  Batch
} from "@spica-devkit/internal_common";
import {StorageObject, BufferWithMeta, ResumableUploadOptions} from "./interface";
import {preparePostBody, preparePutBody, startResumableUpload} from "./utility";
import {
  ApikeyInitialization,
  IdentityInitialization,
  IndexResult,
  HttpService
} from "@spica-server/interface/function/packages";
import {BatchResponse} from "@spica-server/interface/batch";

let authorization;

let service: HttpService;
let publicUrl: string;

export function initialize(options: ApikeyInitialization | IdentityInitialization) {
  const {
    authorization: _authorization,
    service: _service,
    publicUrl: _publicUrl
  } = _initialize(options);

  authorization = _authorization;

  service = _service;
  publicUrl = _publicUrl;
}

export async function insert(
  object: File | BufferWithMeta,
  onUploadProgress?: (progress: ProgressEvent) => void,
  headers: object = {}
) {
  checkInitialized(authorization);
  const postBody = await preparePostBody([object]);

  return service
    .post<StorageObject[]>("storage", postBody.body, {
      onUploadProgress,
      headers: {...postBody.headers, ...headers}
    })
    .then(([r]) => r);
}

export async function insertMany(
  objects: FileList | (File | BufferWithMeta)[],
  onUploadProgress?: (progress: ProgressEvent) => void,
  headers: object = {}
): Promise<StorageObject[]> {
  checkInitialized(authorization);

  const postBody = await preparePostBody(objects);

  return service.post<StorageObject[]>("storage", postBody.body, {
    onUploadProgress,
    headers: {...postBody.headers, ...headers}
  });
}

export function insertResumable(
  object: File | BufferWithMeta,
  headers: Record<string, string>,
  onError?: ResumableUploadOptions["onError"],
  onProgress?: ResumableUploadOptions["onProgress"],
  onSuccess?: ResumableUploadOptions["onSuccess"]
) {
  checkInitialized(authorization);

  return startResumableUpload({
    publicUrl,
    authorization,
    object,
    headers,
    onError,
    onProgress,
    onSuccess
  });
}

export function get(id: string, headers?: object) {
  checkInitialized(authorization);

  return service.get<StorageObject>(`storage/${id}`, {headers});
}

/**
 * Returns Blob for browser environment, ReadableStream for Nodejs environment
 */
export function download(
  id: string,
  options: {
    headers?: any;
    onDownloadProgress?: (progress: ProgressEvent) => void;
  } = {}
) {
  checkInitialized(authorization);

  return service.get(`storage/${id}/view`, {
    headers: options.headers,
    onDownloadProgress: options.onDownloadProgress,
    responseType: isPlatformBrowser() ? "blob" : "stream"
  });
}

export function getAll(
  queryParams?: {
    filter?: object;
    paginate?: false;
    limit?: number;
    skip?: number;
    sort?: object;
  },
  headers?: object
): Promise<StorageObject[]>;
export function getAll(
  queryParams?: {
    filter?: object;
    paginate?: true;
    limit?: number;
    skip?: number;
    sort?: object;
  },
  headers?: object
): Promise<IndexResult<StorageObject>>;
export function getAll(
  queryParams?: {
    filter?: object;
    paginate?: boolean;
    limit?: number;
    skip?: number;
    sort?: object;
  },
  headers?: object
): Promise<IndexResult<StorageObject> | StorageObject[]> {
  checkInitialized(authorization);

  return service.get<IndexResult<StorageObject> | StorageObject[]>(`storage`, {
    params: queryParams,
    headers
  });
}

export async function update(
  id: string,
  object: File | BufferWithMeta,
  onUploadProgress?: (progress: ProgressEvent) => void,
  headers: object = {}
) {
  checkInitialized(authorization);

  const putBody = await preparePutBody(object);

  return service.put<StorageObject>(`storage/${id}`, putBody.body, {
    onUploadProgress,
    headers: {...putBody.headers, ...headers}
  });
}

export async function updateMeta(id: string, meta: {name: string}, headers: object = {}) {
  checkInitialized(authorization);

  return service.patch<StorageObject>(`storage/${id}`, meta, {
    headers: {
      "Content-Type": "application/json",
      ...headers
    }
  });
}

export function remove(id: string, headers?: object) {
  checkInitialized(authorization);

  return service.delete(`storage/${id}`, {headers});
}

export function removeMany(ids: string[], headers?: object) {
  checkInitialized(authorization);

  const batchReqs = Batch.prepareRemoveRequest(ids, "storage", service.getAuthorization(), headers);

  return service
    .post<BatchResponse<string>>("batch", batchReqs, {headers})
    .then(response => Batch.handleBatchResponse<string>(batchReqs, response));
}
