import {Bucket, BucketDocument, RealtimeConnection, RealtimeConnectionOne} from "./interface";
import {
  initialize as _initialize,
  checkInitialized,
  buildUrl,
  Batch
} from "@spica-devkit/internal_common";
import {getWsObs} from "./operators";
import {
  ApikeyInitialization,
  IdentityInitialization,
  IndexResult,
  HttpService
} from "../../../../../../../libs/interface/function/packages";
import {BatchResponse} from "../../../../../../../libs/interface/batch";

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

export function get(id: string, headers?: object): Promise<Bucket> {
  checkInitialized(authorization);

  return service.get<Bucket>(`bucket/${id}`, {headers});
}

export function getAll(headers?: object): Promise<Bucket[]> {
  checkInitialized(authorization);

  return service.get<Bucket[]>("bucket", {headers});
}

export function insert(bucket: Bucket, headers?: object): Promise<Bucket> {
  checkInitialized(authorization);

  return service.post<Bucket>("bucket", bucket, {headers});
}

export function insertMany(buckets: Bucket[], headers?: object) {
  checkInitialized(authorization);

  const batchReqs = Batch.prepareInsertRequest<Bucket>(
    buckets,
    "bucket",
    service.getAuthorization(),
    headers
  );

  return service
    .post<BatchResponse<Bucket>>("batch", batchReqs, {headers})
    .then(response => Batch.handleBatchResponse(batchReqs, response));
}

export function update(id: string, bucket: Bucket, headers?: object): Promise<Bucket> {
  checkInitialized(authorization);

  return service.put<Bucket>(`bucket/${id}`, bucket, {headers});
}

export function remove(id: string, headers?: object): Promise<any> {
  checkInitialized(authorization);

  return service.delete(`bucket/${id}`, {headers});
}

export function removeMany(ids: string[], headers?: object) {
  checkInitialized(authorization);

  const batchReqs = Batch.prepareRemoveRequest(ids, "bucket", service.getAuthorization(), headers);

  return service
    .post<BatchResponse<string>>("batch", batchReqs, {headers})
    .then(response => Batch.handleBatchResponse<string>(batchReqs, response));
}

export namespace data {
  export function get<T>(
    bucketId: string,
    documentId: string,
    options: {
      headers?: object;
      queryParams?: {[key: string]: any};
    } = {}
  ): Promise<T> {
    checkInitialized(authorization);

    return service.get<T>(`bucket/${bucketId}/data/${documentId}`, {
      params: options.queryParams,
      headers: options.headers
    });
  }

  export function getAll<T>(
    bucketId: string,
    options?: {
      headers?: object;
      queryParams?: {[key: string]: any; paginate?: false};
    }
  ): Promise<T[]>;
  export function getAll<T>(
    bucketId: string,
    options?: {
      headers?: object;
      queryParams?: {[key: string]: any; paginate?: true};
    }
  ): Promise<IndexResult<T>>;
  export function getAll<T>(
    bucketId: string,
    options: {
      headers?: object;
      queryParams?: {[key: string]: any; paginate?: boolean};
    } = {}
  ): Promise<T[] | IndexResult<T>> {
    checkInitialized(authorization);

    return service.get<IndexResult<T> | T[]>(`bucket/${bucketId}/data`, {
      params: options.queryParams,
      headers: options.headers
    });
  }

  export function insert<T>(
    bucketId: string,
    document: Omit<T, "_id">,
    headers?: object
  ): Promise<T> {
    checkInitialized(authorization);

    return service.post<T>(`bucket/${bucketId}/data`, document, {headers});
  }

  export function insertMany<T>(bucketId: string, documents: T[], headers?: object) {
    checkInitialized(authorization);

    const batchReqs = Batch.prepareInsertRequest<T>(
      documents,
      `bucket/${bucketId}/data`,
      service.getAuthorization(),
      headers
    );

    return service
      .post<BatchResponse<T>>("batch", batchReqs, {headers})
      .then(response => Batch.handleBatchResponse(batchReqs, response));
  }

  export function update<T>(
    bucketId: string,
    documentId: string,
    document: T,
    headers?: object
  ): Promise<T> {
    checkInitialized(authorization);

    return service.put<T>(`bucket/${bucketId}/data/${documentId}`, document, {headers});
  }

  export function patch(
    bucketId: string,
    documentId: string,
    document: Partial<BucketDocument>,
    headers?: object
  ): Promise<any> {
    checkInitialized(authorization);

    return service.patch(`bucket/${bucketId}/data/${documentId}`, document, {headers});
  }

  export function remove(bucketId: string, documentId: string, headers?: object): Promise<any> {
    checkInitialized(authorization);

    return service.delete(`bucket/${bucketId}/data/${documentId}`, {headers});
  }

  export function removeMany(bucketId: string, documentIds: string[], headers?: object) {
    checkInitialized(authorization);

    const batchReqs = Batch.prepareRemoveRequest(
      documentIds,
      `bucket/${bucketId}/data`,
      service.getAuthorization(),
      headers
    );

    return service
      .post<BatchResponse<string>>("batch", batchReqs, {headers})
      .then(response => Batch.handleBatchResponse<string>(batchReqs, response));
  }

  export namespace realtime {
    /**
     * @param {Object} queryParams - Query params.
     * * @param {string[] | boolean} queryParams.relation - Resolves relation of document(s), but increases the response time.
     */
    export function get<T>(
      bucketId: string,
      documentId: string,
      messageCallback?: (res: {status: number; message: string}) => any,
      queryParams: object = {}
    ): RealtimeConnectionOne<T> {
      checkInitialized(authorization);

      const relation = queryParams["relation"];

      const fullUrl = buildUrl(`${wsUrl}/${bucketId}/data`, {
        filter: `document._id=="${documentId}"`,
        Authorization: authorization
      });

      return getWsObs<T>(
        fullUrl.toString(),
        undefined,
        relation,
        bucketId,
        documentId,
        messageCallback
      );
    }

    /**
     * @param {Object} queryParams - Query params.
     * * @param {string[] | boolean} queryParams.relation - Resolves relation of document(s), but increases the response time.
     */
    export function getAll<T>(
      bucketId: string,
      queryParams: object = {},
      messageCallback?: (res: {status: number; message: string}) => any
    ): RealtimeConnection<T[]> {
      checkInitialized(authorization);

      const sort = queryParams["sort"];
      const relation = queryParams["relation"];

      const fullUrl = buildUrl(`${wsUrl}/${bucketId}/data`, {
        ...queryParams,
        Authorization: authorization
      });

      return getWsObs<T>(fullUrl.toString(), sort, relation, bucketId, undefined, messageCallback);
    }
  }
}
