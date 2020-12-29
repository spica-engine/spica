import {Bucket, BucketDocument, IndexResult, GetAllParams} from "./interface";
// update this import target
import {
  initialize as _initialize,
  checkInitialized,
  ApikeyInitialization,
  IdentityInitialization,
  http
} from "@spica-devkit/internal_common";
import {getWsObs} from "./index";
import {Observable} from "rxjs";
import {map} from "rxjs/operators";

let authorization;

let url;

let wsUrl;

let defaultHeaders;

let writeHeaders;

export function initialize(options: ApikeyInitialization | IdentityInitialization) {
  const {authorization: _authorization, publicUrl} = _initialize(options);

  authorization = _authorization;
  url = publicUrl + "/bucket";
  wsUrl = url.replace("http", "ws");

  defaultHeaders = {
    Authorization: authorization
  };

  writeHeaders = {...defaultHeaders, "Content-Type": "application/json"};
}

export function get(id: string): Promise<Bucket> {
  checkInitialized(authorization);

  return http.get<Bucket>(`${url}/${id}`, {headers: defaultHeaders});
}

export function getAll(): Promise<Bucket[]> {
  checkInitialized(authorization);

  return http.get<Bucket[]>(url, {headers: defaultHeaders});
}

export function insert(bucket: Bucket): Promise<Bucket> {
  checkInitialized(authorization);

  return http.post<Bucket>(url, {
    body: JSON.stringify(bucket),
    headers: writeHeaders
  });
}

export function update(id: string, bucket: Bucket): Promise<Bucket> {
  checkInitialized(authorization);

  return http.put<Bucket>(`${url}/${id}`, {
    body: JSON.stringify(bucket),
    headers: writeHeaders
  });
}

export function remove(id: string): Promise<any> {
  checkInitialized(authorization);

  return http.del(`${url}/${id}`, {headers: defaultHeaders});
}

export namespace data {
  export function get(
    bucketId: string,
    documentId: string,
    options: {headers?: object; queryParams?: object} = {}
  ): Promise<BucketDocument> {
    checkInitialized(authorization);

    const fullUrl = new URL(`${url}/${bucketId}/data/${documentId}`);

    const headers = options.headers;
    addQueryParams(fullUrl, options.queryParams || {});

    // do not allow to overwrite default headers
    return http.get<BucketDocument>(fullUrl, {headers: {...headers, ...defaultHeaders}});
  }

  export function getAll(
    bucketId: string,
    options: {headers?: object; queryParams?: object} = {}
  ): Promise<BucketDocument[] | IndexResult<BucketDocument>> {
    checkInitialized(authorization);

    const fullUrl = new URL(`${url}/${bucketId}/data`);

    const headers = options.headers;
    addQueryParams(fullUrl, options.queryParams || {});

    return http.get<BucketDocument[] | IndexResult<BucketDocument>>(fullUrl, {
      headers: {...defaultHeaders, ...headers}
    });
  }

  export function insert(bucketId: string, document: BucketDocument): Promise<BucketDocument> {
    checkInitialized(authorization);

    return http.post<BucketDocument>(`${url}/${bucketId}/data`, {
      body: JSON.stringify(document),
      headers: writeHeaders
    });
  }

  export function update(
    bucketId: string,
    documentId: string,
    document: BucketDocument
  ): Promise<BucketDocument> {
    checkInitialized(authorization);

    return http.put<BucketDocument>(`${url}/${bucketId}/data/${documentId}`, {
      body: JSON.stringify(document),
      headers: writeHeaders
    });
  }

  export function remove(bucketId: string, documentId: string): Promise<any> {
    checkInitialized(authorization);

    return http.del(`${url}/${bucketId}/data/${documentId}`, {headers: defaultHeaders});
  }

  export namespace realtime {
    export function get(bucketId: string, documentId: string): Observable<BucketDocument> {
      checkInitialized(authorization);

      const filter = `_id=="${documentId}"`;

      const url = `${wsUrl}/bucket/${bucketId}/data?Authorization=${authorization}&filter=${filter}`;

      return getWsObs<BucketDocument[]>(url).pipe(map(([documents]) => documents));
    }

    export function getAll(bucketId: string, params?: GetAllParams): Observable<BucketDocument[]> {
      checkInitialized(authorization);

      let url = `${wsUrl}/bucket/${bucketId}/data?Authorization=${authorization}`;

      let sort;

      if (params) {
        if (params.filter) {
          url += `&filter=${params.filter}`;
        }

        if (params.sort) {
          url += `&sort=${JSON.stringify(params.sort)}`;
          sort = params.sort;
        }

        if (params.limit) {
          url += `&limit=${params.limit}`;
        }

        if (params.skip) {
          url += `&skip=${params.skip}`;
        }
      }

      return getWsObs<BucketDocument[]>(url, sort);
    }
  }
}

function addQueryParams(url: URL, queryParams: object) {
  for (const [key, value] of Object.entries(queryParams)) {
    url.searchParams.append(key, JSON.stringify(value));
  }
}
