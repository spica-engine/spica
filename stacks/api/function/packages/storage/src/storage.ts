import {
  initialize as _initialize,
  http,
  checkInitialized,
  buildUrl,
  Parser
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

let url;

let defaultHeaders;

let writeHeaders;

export function initialize(options: ApikeyInitialization | IdentityInitialization) {
  const {authorization: _authorization, publicUrl} = _initialize(options);

  authorization = _authorization;
  url = publicUrl + "/storage";

  defaultHeaders = {
    Authorization: authorization
  };
  writeHeaders = {...defaultHeaders, "Content-Type": "application/bson"};
}

export async function insert(object: File | BufferWithMeta) {
  checkInitialized(authorization);
  const body = await preparePostBody([object]);

  return http.post<StorageObject>(url, {body, headers: writeHeaders});
}

export async function insertMany(
  objects: FileList | (File | BufferWithMeta)[]
): Promise<StorageObject[]> {
  checkInitialized(authorization);

  const body = await preparePostBody(objects);

  return http.post<StorageObject[]>(url, {body, headers: writeHeaders});
}

export function get(id: string) {
  checkInitialized(authorization);

  return http.get<StorageObject>(`${url}/${id}`, {headers: defaultHeaders});
}

export function download(id: string, headers: object = {}) {
  checkInitialized(authorization);

  return http.get<Blob>(
    `${url}/${id}/view`,
    {headers: {...headers, ...defaultHeaders}},
    Parser.Blob
  );
}

export function getAll(queryParams: {limit?: number; skip?: number; sort?: object} = {}) {
  checkInitialized(authorization);

  const fullUrl = buildUrl(url, queryParams);

  return http.get<IndexResult<StorageObject>>(fullUrl, {headers: defaultHeaders});
}

export async function update(id: string, object: File | BufferWithMeta) {
  checkInitialized(authorization);

  const body = await preparePutBody(object);

  return http.put<StorageObject>(`${url}/${id}`, {
    body,
    headers: writeHeaders
  });
}

export function remove(id: string) {
  checkInitialized(authorization);

  return http.del(`${url}/${id}`, {headers: defaultHeaders});
}
