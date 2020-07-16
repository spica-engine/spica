import fetch from "node-fetch";
import {Bucket, BucketDocument, IndexResult} from "./interface";

let _apikey = "";
let url = "";

export function initialize(apikey: string) {
  _apikey = `APIKEY ${apikey}`;

  let publicUrl = process.env.__INTERNAL__SPICA__PUBLIC_URL__;
  if (!publicUrl) {
    throw new Error("The <__INTERNAL__SPICA__PUBLIC_URL__> variable was not given. ");
  }

  url = `${publicUrl}/bucket`;
}

function checkInitialized() {
  if (!_apikey) {
    throw new Error("You should call initialize method with apikey before this action.");
  }
}

export function get(id: string): Promise<Bucket> {
  checkInitialized();

  let request = {
    method: "get",
    headers: {
      Authorization: _apikey
    }
  };

  return fetch(url + "/" + id, request).then(res => res.json());
}

export function getAll(): Promise<Bucket[] | IndexResult<Bucket>> {
  checkInitialized();

  let request = {
    method: "get",
    headers: {
      Authorization: _apikey
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
      Authorization: _apikey,
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
      Authorization: _apikey,
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
      Authorization: _apikey
    }
  };
  return fetch(url + "/" + id, request);
}

export namespace data {
  export function get(
    bucketId: string,
    documentId: string,
    headers: object = {},
    queryParams: object = {}
  ): Promise<BucketDocument> {
    checkInitialized();

    let fullUrl = new URL(`${url}/${bucketId}/data/${documentId}`);

    Object.entries(queryParams).forEach(([key, value]) =>
      fullUrl.searchParams.append(key, JSON.stringify(value))
    );

    let request = {
      method: "get",
      headers: {
        ...headers,
        Authorization: _apikey
      }
    };

    return fetch(fullUrl, request).then(res => res.json());
  }

  export function getAll(
    bucketId: string,
    headers: object = {},
    queryParams: object = {}
  ): Promise<BucketDocument[] | IndexResult<BucketDocument>> {
    checkInitialized();

    let fullUrl = new URL(`${url}/${bucketId}/data`);

    Object.entries(queryParams).forEach(([key, value]) =>
      fullUrl.searchParams.append(key, JSON.stringify(value))
    );

    let request = {
      method: "get",
      headers: {
        ...headers,
        Authorization: _apikey
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
        Authorization: _apikey,
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
        Authorization: _apikey,
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
        Authorization: _apikey
      }
    };
    return fetch(`${url}/${bucketId}/data/${documentId}`, request);
  }
}
