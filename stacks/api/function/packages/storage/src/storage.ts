import {
  initialize as _initialize,
  http,
  checkInitialized,
  buildUrl,
  Parser
} from "@spica-devkit/internal_common";
import {
  StorageObject,
  Base64WithMeta,
  IndexResult,
  ApikeyInitialization,
  IdentityInitialization
} from "./interface";
import {prepareBody} from "./utility";

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
  writeHeaders = {...defaultHeaders, "Content-Type": "application/json"};
}

// we may decide to remove it.
export async function insert(object: File | Base64WithMeta) {
  checkInitialized(authorization);

  const body = await prepareBody(object);

  return http.post<StorageObject>(url, {body: JSON.stringify([body]), headers: writeHeaders});
}

export async function insertMany(
  objects: File[] | FileList | Base64WithMeta[]
): Promise<StorageObject[]> {
  checkInitialized(authorization);

  // FileList to File array
  if (!Array.isArray(objects)) {
    objects = Array.from(objects);
  }

  const promises = [];

  for (const object of objects) {
    promises.push(prepareBody(object));
  }

  const body = await Promise.all(promises);

  return http.post<StorageObject[]>(url, {body: JSON.stringify(body), headers: writeHeaders});
}

export function get(id: string) {
  checkInitialized(authorization);

  return http.get<StorageObject>(`${url}/${id}`, {headers: defaultHeaders});
}

export function download(id: string) {
  checkInitialized(authorization);

  return http.get<Blob>(`${url}/${id}/view`, {headers: defaultHeaders}, Parser.Blob);
}

export function getAll(queryParams: {limit?: number; skip?: number; sort?: object} = {}) {
  checkInitialized(authorization);

  const fullUrl = buildUrl(url, queryParams);

  return http.get<IndexResult<StorageObject>>(fullUrl, {headers: defaultHeaders});
}

export async function update(id: string, object: File | Base64WithMeta) {
  checkInitialized(authorization);

  const body = await prepareBody(object);

  return http.put<StorageObject>(`${url}/${id}`, {
    body: JSON.stringify(body),
    headers: writeHeaders
  });
}

export function remove(id: string) {
  checkInitialized(authorization);

  return http.del(`${url}/${id}`, {headers: defaultHeaders});
}
