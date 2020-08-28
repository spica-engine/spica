import fetch from "node-fetch";
import {Bucket, BucketDocument, IndexResult} from "./interface";

let apikey;
let url;

export function initialize(options: {apikey: string; publicUrl?: string}) {
  apikey = `APIKEY ${options.apikey}`;

  let _publicUrl = options.publicUrl || process.env.__INTERNAL__SPICA__PUBLIC_URL__;
  if (!_publicUrl) {
    throw new Error(
      "The <__INTERNAL__SPICA__PUBLIC_URL__> variable and public url was not given. "
    );
  }

  url = `${_publicUrl}/bucket`;
}

function checkInitialized() {
  if (!apikey) {
    throw new Error("You should call initialize method with apikey before this action.");
  }
}

export function get(id: string): Promise<Bucket> {
  checkInitialized();

  let request = {
    method: "get",
    headers: {
      Authorization: apikey
    }
  };

  return fetch(url + "/" + id, request).then(res => res.json());
}

export function getAll(): Promise<Bucket[]> {
  checkInitialized();

  let request = {
    method: "get",
    headers: {
      Authorization: apikey
    }
  };

  return fetch(url, request).then(res => res.json());
}

export function insert(bucket: Bucket): Promise<Bucket> {
  checkInitialized();

  let request = {
    method: "post",
    body: JSON.stringify(bucket),
    headers: {
      Authorization: apikey,
      "Content-Type": "application/json"
    }
  };
  return fetch(url, request).then(res => res.json());
}

export function update(id: string, bucket: Bucket): Promise<Bucket> {
  checkInitialized();

  let request = {
    method: "put",
    body: JSON.stringify(bucket),
    headers: {
      Authorization: apikey,
      "Content-Type": "application/json"
    }
  };
  return fetch(url + "/" + id, request).then(res => res.json());
}

export function remove(id: string): Promise<any> {
  checkInitialized();

  let request = {
    method: "delete",
    headers: {
      Authorization: apikey
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

    let fullUrl = new URL(`${url}/${bucketId}/data/${documentId}`);

    let headers;

    if (options) {
      headers = options.headers;
      Object.entries(options.queryParams).forEach(([key, value]) =>
        fullUrl.searchParams.append(key, JSON.stringify(value))
      );
    }

    let request = {
      method: "get",
      headers: {
        ...headers,
        Authorization: apikey
      }
    };

    return fetch(fullUrl, request).then(res => res.json());
  }

  export function getAll(
    bucketId: string,
    options?: {headers?: object; queryParams?: object}
  ): Promise<BucketDocument[] | IndexResult<BucketDocument>> {
    checkInitialized();

    let fullUrl = new URL(`${url}/${bucketId}/data`);

    let headers;

    if (options) {
      headers = options.headers;
      Object.entries(options.queryParams).forEach(([key, value]) =>
        fullUrl.searchParams.append(key, JSON.stringify(value))
      );
    }

    let request = {
      method: "get",
      headers: {
        ...headers,
        Authorization: apikey
      }
    };

    return fetch(fullUrl, request).then(res => res.json());
  }

  export function insert(bucketId: string, document: BucketDocument): Promise<BucketDocument> {
    checkInitialized();

    let request = {
      method: "post",
      body: JSON.stringify(document),
      headers: {
        Authorization: apikey,
        "Content-Type": "application/json"
      }
    };
    return fetch(`${url}/${bucketId}/data`, request).then(res => res.json());
  }

  export function update(
    bucketId: string,
    documentId: string,
    document: BucketDocument
  ): Promise<BucketDocument> {
    checkInitialized();

    let request = {
      method: "put",
      body: JSON.stringify(document),
      headers: {
        Authorization: apikey,
        "Content-Type": "application/json"
      }
    };
    return fetch(`${url}/${bucketId}/data/${documentId}`, request).then(res => res.json());
  }

  export function remove(bucketId: string, documentId: string): Promise<any> {
    checkInitialized();

    let request = {
      method: "delete",
      headers: {
        Authorization: apikey
      }
    };
    return fetch(`${url}/${bucketId}/data/${documentId}`, request);
  }
}
