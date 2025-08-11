import {useCallback} from "react";
import useApi from "../hooks/useApi";

export type BucketDataType = {
  data: {[key: string]: any}[];
  meta: {
    total: number;
  };
};

export type BucketDataWithIdType = BucketDataType & {bucketId: string};

export type BucketType = {
  _id: string;
  title: string;
  properties: Properties;
  required?: string[];
  [key: string]: any;
};

type Properties = {[key: string]: Property};

type Property =
  | BasicProperty
  | ArrayProperty
  | ObjectProperty
  | RelationProperty
  | LocationProperty;

interface IProperty {
  type: string;
  enum?: any[];
  [key: string]: any;
}

interface BasicProperty extends IProperty {
  type: "string" | "textarea" | "color" | "richtext" | "storage" | "number" | "date" | "boolean";
  options: {
    translate: boolean;
  };
}

interface ArrayProperty extends IProperty {
  type: "array" | "multiselect";
  items: Property;
}

interface ObjectProperty extends IProperty {
  type: "object";
  properties: Properties;
  required?: string[];
}

interface RelationProperty extends IProperty {
  type: "relation";
  bucketId: string;
  relationType: "onetoone" | "onetomany";
}

interface LocationProperty extends IProperty {
  type: "location";
}

export type BucketDataQueryType = {
  paginate?: boolean;
  relation?: boolean;
  limit?: number;
  sort?: Record<string, number>;
  skip?: number;
};

export type BucketDataQueryWithIdType = BucketDataQueryType & {bucketId: string};

/**
 * useBucketService: Custom hook for bucket-related API calls.
 *
 * Naming conventions:
 * - Functions are API-only; they DO NOT update React state.
 * - Prefix all function names with `api` (e.g., apiGetBuckets, apiDeleteBucket).
 * - Function names closely mirror backend operations.
 * - No side effects or state management here.
 *
 * Usage:
 * - Import and call these functions in BucketContext or other hooks/components.
 * - Keep all network requests centralized here.
 * - Separate business logic (state updates, orchestration) to BucketContext.
 */
export const useBucketService = () => {
  const {request: fetchBuckets, data: apiBuckets} = useApi<BucketType[]>({
    endpoint: "/api/bucket",
    method: "get"
  });

  const {request: fetchBucketData, data: apiBucketData, loading: apiBucketDataLoading} = useApi<BucketDataType>({
    endpoint: "",
    method: "get"
  });

  const {request: bucketOrderRequest} = useApi({endpoint: "", method: "patch"});

  const {request: patchRequest} = useApi({endpoint: "/api/bucket", method: "patch"});

  const {request: deleteRequest} = useApi({
    endpoint: "",
    method: "delete"
  });

  const {request: requestNameChange} = useApi({
    endpoint: "",
    method: "put"
  });

    const {request: bucketLimitationRequest} = useApi({
    endpoint: "",
    method: "put"
  });

  const apiGetBucketData = useCallback(
    (bucketId: string, queryString?: string) => {
      return fetchBucketData({
        endpoint: `/api/bucket/${bucketId}/data?${queryString}`
      });
    },
    [fetchBucketData]
  );

  const apiChangeBucketCategory = useCallback(
    (bucketId: string, category: string) => {
      return patchRequest({body: {category}, endpoint: `/api/bucket/${bucketId}`});
    },
    [patchRequest]
  );

  const apiChangeBucketOrder = useCallback(
    (bucketId: string, order: number) => {
      return bucketOrderRequest({endpoint: `/api/bucket/${bucketId}`, body: {order}});
    },
    [bucketOrderRequest]
  );

  const apiRenameBucket = useCallback(
    async (newTitle: string, bucket: BucketType) => {
      try {
        const body = {...bucket, title: newTitle};
        delete (body as unknown as {section: any}).section;
        delete (body as unknown as {index: any}).index;
        return await requestNameChange({body, endpoint: `/api/bucket/${bucket._id}`});
      } catch (err) {
        console.error(err);
      }
    },
    [requestNameChange]
  );

  const apiDeleteBucket = useCallback(
    (bucketId: string) => {
      return deleteRequest({
        endpoint: `/api/bucket/${bucketId}`
      });
    },
    [deleteRequest]
  );

    const apiUpdatebucketLimitiation = useCallback(
    async (bucketId: string, body: Record<string, any>) => {
      return await bucketLimitationRequest({
        endpoint: `/api/bucket/${bucketId}`,
        body
      });
    },
    [bucketLimitationRequest]
  );

  const apiUpdatebucketLimitiationFields = useCallback((bucket: BucketType) => {
    return bucketLimitationRequest({
      endpoint: `/api/bucket/${bucket._id}`,
      body: bucket
    });
  }, [])

  return {
    apiGetBucketData,
    apiGetBuckets: fetchBuckets,
    apiChangeBucketCategory,
    apiChangeBucketOrder,
    apiRenameBucket,
    apiDeleteBucket,
    apiUpdatebucketLimitiation,
    apiUpdatebucketLimitiationFields,
    apiBuckets,
    apiBucketData,
    apiBucketDataLoading,
  };
};
