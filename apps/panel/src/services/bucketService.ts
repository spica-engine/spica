import {useCallback} from "react";
import useApi from "../hooks/useApi";
import {useMemo} from "react";

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
  currentBucketQuery?: {
    paginate?: boolean;
    relation?: boolean;
    limit?: number;
    sort?: Record<string, number>;
  };
}

export const useBucketService = ({currentBucketQuery}: UseBucketServiceOptions = {}) => {
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
    endpoint: "",
    method: "get"
  });

  const getCurrentBucket = (bucketId: string) => {
    return fetchCurrentBucket({
      endpoint: `/api/bucket/${bucketId}/data?${currentBucketQueryString}`
    });
  };

  const {
    request: bucketOrderRequest,
    loading: bucketOrderLoading,
    error: bucketOrderError
  } = useApi({endpoint: "", method: "patch"});

  const changeBucketOrder = useCallback((bucketId: string, order: number) => {
    bucketOrderRequest({endpoint: `/api/bucket/${bucketId}`, body: {order}});
  }, []);

  const {request: requestNameChange, loading: bucketNameChangeLoading} = useApi({
    endpoint: "",
    method: "put"
  });

  const requestBucketNameChange = useCallback(
    (newTitle: string, bucket: BucketType, onSuccess?: () => void) => {
      const body = {...bucket, title: newTitle};
      delete (body as unknown as {section: any}).section;
      delete (body as unknown as {index: any}).index;
      requestNameChange({body, endpoint: `/api/bucket/${bucket._id}`}).then(result => {
        if (!result) return;
        onSuccess?.();
      });
    },
    []
  );

  return {
    buckets,
    fetchBuckets,
    error,
    loading,
    currentBucket,
    getCurrentBucket,
    currentBucketLoading,
    currentBucketError,
    changeBucketOrder,
    bucketOrderLoading,
    bucketOrderError,
    requestBucketNameChange,
    bucketNameChangeLoading
  };
};
