import {useCallback, useState} from "react";
import useApi from "../hooks/useApi";

export type BucketDataType = {
  data: {[key: string]: any}[];
  meta: {
    total: number;
  };
};

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

export const useBucketService = () => {
  const [lastUsedBucketDataQuery, setLastUsedBucketDataQuery] =
    useState<BucketDataQueryType | null>(null);

  const {
    request: fetchBuckets,
    data: buckets,
    error,
    loading
  } = useApi<BucketType[]>({
    endpoint: "/api/bucket",
    method: "get"
  });

  const {
    request: fetchBucketData,
    data: bucketData,
    loading: bucketDataLoading,
    error: bucketDataError
  } = useApi<BucketDataType>({
    endpoint: "",
    method: "get"
  });

  const getBucketData = useCallback(
    (bucketId: string, query?: BucketDataQueryType) => {
      const defaultParams: Omit<BucketDataQueryType, "sort"> & {sort: string} = {
        paginate: true,
        relation: true,
        limit: 25,
        sort: JSON.stringify({_id: -1})
      };

      // Create a mutable copy of params
      let params = query
        ? {
            ...defaultParams,
            ...query,
            sort: query.sort ? JSON.stringify(query.sort) : defaultParams.sort
          }
        : {...defaultParams};

      // Remove sort if it's undefined or empty
      if (!params.sort || Object.keys(JSON.parse(params.sort)).length === 0) {
        const {sort, ...rest} = params;
        params = rest as typeof params;
      }
      
      const queryString = new URLSearchParams(
        params as unknown as Record<string, string>
      ).toString();
      
      return fetchBucketData({
        endpoint: `/api/bucket/${bucketId}/data?${queryString}`
      }).then(result => {
        setLastUsedBucketDataQuery(query ?? {...defaultParams, sort: {_id: -1}});
        return result;
      });
    },
    [fetchBucketData]
  );

  const {
    request: fetchCurrentBucket,
    data: currentBucket,
    loading: currentBucketLoading,
    error: currentBucketError
  } = useApi<BucketType>({
    endpoint: "",
    method: "get"
  });

  const getCurrentBucket = useCallback((bucketId: string) => {
    return fetchCurrentBucket({
      endpoint: `/api/bucket/${bucketId}`
    });
  }, [fetchCurrentBucket]);

  const {
    request: bucketOrderRequest,
    loading: bucketOrderLoading,
    error: bucketOrderError
  } = useApi({endpoint: "", method: "patch"});

  const changeBucketOrder = useCallback((bucketId: string, order: number) => {
    return bucketOrderRequest({endpoint: `/api/bucket/${bucketId}`, body: {order}});
  }, [bucketOrderRequest]);

  return {
    loading,
    error,
    fetchBuckets,
    bucketData,
    bucketDataLoading,
    bucketDataError,
    getBucketData,
    lastUsedBucketDataQuery,
    changeBucketOrder,
    bucketOrderLoading,
    bucketOrderError,
    buckets,
    /*
    buckets,
    fetchBuckets,
    error,
    loading,
    bucketData,
    getBucketData,
    bucketDataLoading,
    bucketDataError,
    lastUsedBucketDataQuery,
    changeBucketOrder,
    bucketOrderLoading,
    bucketOrderError
    */
  };
};
