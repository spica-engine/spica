import {useParams} from "react-router-dom";
import useApi from "../hooks/useApi";
import {use, useEffect, useMemo} from "react";

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

interface UseBucketServiceOptions {
  bucketId: string | null;
  currentBucketQuery?: {
    paginate?: boolean;
    relation?: boolean;
    limit?: number;
    sort?: Record<string, number>;
  };
}

export const useBucketService = ({bucketId, currentBucketQuery}: UseBucketServiceOptions) => {
  const {
    request: fetchBuckets,
    data: buckets,
    error,
    loading
  } = useApi<BucketType[]>({
    endpoint: "/api/bucket",
    method: "get"
  });

  const currentBucketQueryString = useMemo(() => {
    const defaultParams: Record<string, any> = {
      paginate: true,
      relation: true,
      limit: 25,
      sort: JSON.stringify({_id: -1})
    };

    const params = currentBucketQuery
      ? {
          ...currentBucketQuery,
          sort: currentBucketQuery.sort ? JSON.stringify(currentBucketQuery.sort) : undefined
        }
      : defaultParams;

    return new URLSearchParams(params).toString();
  }, [currentBucketQuery]);

  const {
    request: fetchCurrentBucket,
    data: currentBucket,
    loading: currentBucketLoading,
    error: currentBucketError
  } = useApi<BucketType>({
    endpoint: `/api/bucket/${bucketId}/data?${currentBucketQueryString}`,
    method: "get"
  });

  useEffect(() => {
    if (bucketId) fetchCurrentBucket();
  }, [bucketId]);

  return {
    buckets,
    fetchBuckets,
    error,
    loading,
    currentBucket,
    fetchCurrentBucket,
    currentBucketLoading,
    currentBucketError
  };
};
