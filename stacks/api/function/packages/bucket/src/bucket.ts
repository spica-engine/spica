import {Bucket, BucketDocument, RealtimeConnection, RealtimeConnectionOne} from "./interface";
import {
  initialize as _initialize,
  checkInitialized,
  buildUrl,
  HttpService,
  ApikeyInitialization,
  IdentityInitialization,
  IndexResult
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

  export function insert<T>(bucketId: string, document: Omit<T, "_id">): Promise<T> {
    checkInitialized(authorization);

    return service.post<T>(`bucket/${bucketId}/data`, document);
  }

  export function update<T>(bucketId: string, documentId: string, document: T): Promise<T> {
    checkInitialized(authorization);

    return service.put<T>(`bucket/${bucketId}/data/${documentId}`, document);
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
    export function get<T>(
      bucketId: string,
      documentId: string,
      messageCallback?: (res: {status: number; message: string}) => any
    ): RealtimeConnectionOne<T> {
      checkInitialized(authorization);

      const fullUrl = buildUrl(`${wsUrl}/${bucketId}/data`, {
        filter: `document._id=="${documentId}"`,
        Authorization: authorization
      });

      return getWsObs<T>(fullUrl.toString(), undefined, documentId, messageCallback);
    }

    export function getAll<T>(
      bucketId: string,
      queryParams: object = {},
      messageCallback?: (res: {status: number; message: string}) => any
    ): RealtimeConnection<T[]> {
      checkInitialized(authorization);

      const sort = queryParams["sort"];

      const fullUrl = buildUrl(`${wsUrl}/${bucketId}/data`, {
        ...queryParams,
        Authorization: authorization
      });

      return getWsObs<T>(fullUrl.toString(), sort, undefined, messageCallback);
    }
  }
}
