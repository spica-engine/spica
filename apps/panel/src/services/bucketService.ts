import {useCallback, useState} from "react";
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

export const useBucketService = () => {
  const [lastUsedBucketDataQuery, setLastUsedBucketDataQuery] =
    useState<BucketDataQueryWithIdType | null>(null);

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

      let params = query
        ? {
            ...defaultParams,
            ...query,
            sort: query.sort ? JSON.stringify(query.sort) : defaultParams.sort
          }
        : {...defaultParams};

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
        if (!result) return;
        setLastUsedBucketDataQuery(
          query ? {...query, bucketId} : {...defaultParams, sort: {_id: -1}, bucketId}
        );
        return result;
      });
    },
    [fetchBucketData]
  );

  const {request: patchRequest} = useApi({endpoint: "/api/bucket", method: "patch"});

  const requestCategoryChange = useCallback((bucketId: string, category: string) => {
    return patchRequest({body: {category}, endpoint: `/api/bucket/${bucketId}`});
  }, []);

  const {
    request: bucketOrderRequest,
    loading: bucketOrderLoading,
    error: bucketOrderError
  } = useApi({endpoint: "", method: "patch"});

  const changeBucketOrder = useCallback(
    (bucketId: string, order: number) => {
      return bucketOrderRequest({endpoint: `/api/bucket/${bucketId}`, body: {order}});
    },
    [bucketOrderRequest]
  );

  const {request: requestNameChange} = useApi({
    endpoint: "",
    method: "put"
  });

  const requestBucketNameChange = useCallback(async (newTitle: string, bucket: BucketType) => {
    try {
      const body = {...bucket, title: newTitle};
      delete (body as unknown as {section: any}).section;
      delete (body as unknown as {index: any}).index;
      return await requestNameChange({body, endpoint: `/api/bucket/${bucket._id}`});
    } catch (err) {
      console.error(err);
    }
  }, [requestNameChange]);

  const {request: deleteRequest} = useApi({
    endpoint: "",
    method: "delete"
  });

  const deleteBucketRequest = useCallback((bucketId: string) => {
    return deleteRequest({
      endpoint: `/api/bucket/${bucketId}`
    });
  }, []);

  const changeBucketReadOnly = useCallback(async (bucket: BucketType) => {
    return await patchRequest({
      endpoint: `/api/bucket/${bucket._id}`,
      body: {
        ...bucket,
        readOnly: !bucket.readOnly
      }
    });
  }, [patchRequest]);

  return {
    loading,
    error,
    fetchBuckets,
    bucketData,
    getBucketData,
    lastUsedBucketDataQuery,
    requestCategoryChange,
    changeBucketOrder,
    bucketOrderLoading,
    bucketOrderError,
    requestBucketNameChange,
    buckets,
    deleteBucketRequest,
    changeBucketReadOnly
  };
};
