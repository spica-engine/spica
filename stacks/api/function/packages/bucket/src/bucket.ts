import {
  Bucket,
  BucketDocument,
  ApikeyInitialization,
  IdentityInitialization,
  IndexResult
} from "@spica-devkit/bucket";
import {
  initialize as _initialize,
  checkInitialized,
  buildUrl,
  HttpService
} from "@spica-devkit/internal_common";
import {getWsObs} from "./operators";

// do not remove these unused imports
import {Observable} from "rxjs";
import {map} from "rxjs/operators";

let authorization;

let wsUrl;

let service: HttpService;

export function initialize(options: ApikeyInitialization | IdentityInitialization) {
  const {authorization: _authorization, publicUrl, service: _service} = _initialize(options);

  authorization = _authorization;

  service = _service;

  wsUrl = (publicUrl + "/bucket").replace("http", "ws");

  service.setWriteDefaults({
    headers: {
      "Content-Type": "application/json"
    }
  });
}

export function get(id: string): Promise<Bucket> {
  checkInitialized(authorization);

  return service.get<Bucket>(`bucket/${id}`);
}

export function getAll(): Promise<Bucket[]> {
  checkInitialized(authorization);

  return service.get<Bucket[]>("bucket");
}

export function insert(bucket: Bucket): Promise<Bucket> {
  checkInitialized(authorization);

  return service.post<Bucket>("bucket", bucket);
}

export function update(id: string, bucket: Bucket): Promise<Bucket> {
  checkInitialized(authorization);

  return service.put<Bucket>(`bucket/${id}`, bucket);
}

export function remove(id: string): Promise<any> {
  checkInitialized(authorization);

  return service.delete(`bucket/${id}`);
}

export namespace data {
  export function get<BucketDocument>(
    bucketId: string,
    documentId: string,
    options: {headers?: object; queryParams?: object} = {}
  ): Promise<BucketDocument> {
    checkInitialized(authorization);

    return service.get<BucketDocument>(`bucket/${bucketId}/data/${documentId}`, {
      params: options.queryParams,
      headers: options.headers
    });
  }

  export function getAll<BucketDocument>(
    bucketId: string,
    options?: {headers?: object; queryParams?: {[key: string]: any; paginate?: false}}
  ): Promise<BucketDocument[]>;
  export function getAll<BucketDocument>(
    bucketId: string,
    options?: {headers?: object; queryParams?: {[key: string]: any; paginate?: true}}
  ): Promise<IndexResult<BucketDocument>>;
  export function getAll<BucketDocument>(
    bucketId: string,
    options: {headers?: object; queryParams?: {[key: string]: any; paginate?: boolean}} = {}
  ): Promise<BucketDocument[] | IndexResult<BucketDocument>> {
    checkInitialized(authorization);

    return service.get<BucketDocument[] | IndexResult<BucketDocument>>(`bucket/${bucketId}/data`, {
      params: options.queryParams,
      headers: options.headers
    });
  }

  export function insert(bucketId: string, document: BucketDocument): Promise<BucketDocument> {
    checkInitialized(authorization);

    return service.post<BucketDocument>(`bucket/${bucketId}/data`, document);
  }

  export function update(
    bucketId: string,
    documentId: string,
    document: BucketDocument
  ): Promise<BucketDocument> {
    checkInitialized(authorization);

    return service.put<BucketDocument>(`bucket/${bucketId}/data/${documentId}`, document);
  }

  export function patch(
    bucketId: string,
    documentId: string,
    document: Partial<BucketDocument>
  ): Promise<any> {
    checkInitialized(authorization);

    return service.patch(`bucket/${bucketId}/data/${documentId}`, document);
  }

  export function remove(bucketId: string, documentId: string): Promise<any> {
    checkInitialized(authorization);

    return service.delete(`bucket/${bucketId}/data/${documentId}`);
  }

  export namespace realtime {
    export function get<BucketDocument>(
      bucketId: string,
      documentId: string,
      messageCallback?: (res: {status: number; message: string}) => any
    ) {
      checkInitialized(authorization);

      const fullUrl = buildUrl(`${wsUrl}/${bucketId}/data`, {
        filter: `_id=="${documentId}"`,
        Authorization: authorization
      });

      return getWsObs<BucketDocument>(fullUrl.toString(), undefined, true, messageCallback);
    }

    export function getAll<BucketDocument>(
      bucketId: string,
      queryParams: object = {},
      messageCallback?: (res: {status: number; message: string}) => any
    ) {
      checkInitialized(authorization);

      const sort = queryParams["sort"];

      const fullUrl = buildUrl(`${wsUrl}/${bucketId}/data`, {
        ...queryParams,
        Authorization: authorization
      });

      return getWsObs<BucketDocument>(fullUrl.toString(), sort, false, messageCallback);
    }
  }
}
