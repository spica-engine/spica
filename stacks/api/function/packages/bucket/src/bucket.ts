import fetch from "node-fetch";
import {
  Bucket,
  BucketDocument,
  IndexResult,
  GetAllParams,
  ApikeyInitialization,
  IdentityInitialization
} from "./interface";
import {getWsObs} from "./index";
import {Observable} from "rxjs";
import {map} from "rxjs/operators";
import {URL} from "url";

let authorization;

let url;
let wsUrl;

export function initialize(options: ApikeyInitialization | IdentityInitialization) {
  if ("apikey" in options) {
    authorization = `APIKEY ${options.apikey}`;
  } else if ("identity" in options) {
    authorization = `IDENTITY ${options.identity}`;
  }

  const _publicUrl = options.publicUrl || process.env.__INTERNAL__SPICA__PUBLIC_URL__;
  if (!_publicUrl) {
    throw new Error(
      "The <__INTERNAL__SPICA__PUBLIC_URL__> variable and public url was not given. "
    );
  }

  url = `${_publicUrl}/bucket`;
  wsUrl = _publicUrl.replace("http", "ws");
}

function checkInitialized() {
  if (!authorization) {
    throw new Error(
      "You should call initialize method with apikey or identity before this action."
    );
  }
}

const completeResponse = (response: any) => {
  const warning = response.headers.get("warning");
  if (warning) {
    console.warn(warning);
  }
  return response.json();
};

export function get(id: string): Promise<Bucket> {
  checkInitialized();

  const request = {
    method: "get",
    headers: {
      Authorization: authorization
    }
  };

  return fetch(url + "/" + id, request).then(completeResponse);
}

export function getAll(): Promise<Bucket[]> {
  checkInitialized();

  const request = {
    method: "get",
    headers: {
      Authorization: authorization
    }
  };

  return fetch(url, request).then(completeResponse);
}

export function insert(bucket: Bucket): Promise<Bucket> {
  checkInitialized();

  const request = {
    method: "post",
    body: JSON.stringify(bucket),
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json"
    }
  };
  return fetch(url, request).then(completeResponse);
}

export function update(id: string, bucket: Bucket): Promise<Bucket> {
  checkInitialized();

  const request = {
    method: "put",
    body: JSON.stringify(bucket),
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json"
    }
  };
  return fetch(url + "/" + id, request).then(completeResponse);
}

export function remove(id: string): Promise<any> {
  checkInitialized();

  const request = {
    method: "delete",
    headers: {
      Authorization: authorization
    }
  };
  return fetch(url + "/" + id, request);
}

export namespace data {
  export function get(
    bucketId: string,
    documentId: string,
    options?: {headers?: object; queryParams?: object}
  ): Promise<BucketDocument> {
    checkInitialized();

    const fullUrl = new URL(`${url}/${bucketId}/data/${documentId}`);

    let headers;

    if (options) {
      headers = options.headers;
      Object.entries(options.queryParams).forEach(([key, value]) =>
        fullUrl.searchParams.append(key, JSON.stringify(value))
      );
    }

    const request = {
      method: "get",
      headers: {
        ...headers,
        Authorization: authorization
      }
    };

    return fetch(fullUrl, request).then(completeResponse);
  }

  export function getAll(
    bucketId: string,
    options?: {headers?: object; queryParams?: object}
  ): Promise<BucketDocument[] | IndexResult<BucketDocument>> {
    checkInitialized();

    const fullUrl = new URL(`${url}/${bucketId}/data`);

    let headers;

    if (options) {
      headers = options.headers;
      Object.entries(options.queryParams).forEach(([key, value]) =>
        fullUrl.searchParams.append(key, JSON.stringify(value))
      );
    }

    const request = {
      method: "get",
      headers: {
        ...headers,
        Authorization: authorization
      }
    };

    return fetch(fullUrl, request).then(completeResponse);
  }

  export function insert(bucketId: string, document: BucketDocument): Promise<BucketDocument> {
    checkInitialized();

    const request = {
      method: "post",
      body: JSON.stringify(document),
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json"
      }
    };
    return fetch(`${url}/${bucketId}/data`, request).then(completeResponse);
  }

  export function update(
    bucketId: string,
    documentId: string,
    document: BucketDocument
  ): Promise<BucketDocument> {
    checkInitialized();

    const request = {
      method: "put",
      body: JSON.stringify(document),
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json"
      }
    };
    return fetch(`${url}/${bucketId}/data/${documentId}`, request).then(completeResponse);
  }

  export function remove(bucketId: string, documentId: string): Promise<any> {
    checkInitialized();

    const request = {
      method: "delete",
      headers: {
        Authorization: authorization
      }
    };
    return fetch(`${url}/${bucketId}/data/${documentId}`, request);
  }

  export namespace realtime {
    export function get(bucketId: string, documentId: string): Observable<BucketDocument> {
      checkInitialized();

      const filter = `_id=="${documentId}"`;

      const url = `${wsUrl}/bucket/${bucketId}/data?Authorization=${authorization}&filter=${filter}`;

      return getWsObs<BucketDocument[]>(url).pipe(map(([documents]) => documents));
    }
    export function getAll(bucketId: string, params?: GetAllParams): Observable<BucketDocument[]> {
      checkInitialized();

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
