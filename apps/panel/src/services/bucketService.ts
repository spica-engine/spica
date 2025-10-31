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

export type Properties = {[key: string]: Property};

export type Property =
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

  const {
    request: fetchBucketData,
    data: apiBucketData,
    loading: apiBucketDataLoading
  } = useApi<BucketDataType>({
    endpoint: "",
    method: "get",
    deduplicateRequests: true
  });

  const {request: bucketOrderRequest} = useApi({endpoint: "", method: "patch"});

  const {request: patchRequest} = useApi({endpoint: "/api/bucket", method: "patch"});

  const {request: deleteRequest} = useApi({
    endpoint: "",
    method: "delete"
  });

  const {
    request: deleteHistoty,
    loading: apiDeleteBucketHistoryLoading,
    error: apiDeleteBucketHistoryError
  } = useApi({
    endpoint: "",
    method: "delete"
  });

  const {request: putRequest} = useApi({
    endpoint: "",
    method: "put"
  });

  const {
    request: updateBucketRule,
    loading: apiUpdateBucketRuleLoading,
    error: apiUpdateBucketRuleError
  } = useApi({
    endpoint: "",
    method: "put"
  });

  const {
    request: bucketLimitationRequest,
    loading: apiUpdateBucketLimitationFieldsLoading,
    error: apiUpdateBucketLimitationFieldsError
  } = useApi({
    endpoint: "",
    method: "put"
  });

  const {request: postRequest} = useApi<BucketType>({
    endpoint: "/api/bucket",
    method: "post"
  });

  const {request: createBucketField, error: apiCreateBucketFieldError} = useApi({
    endpoint: "",
    method: "put"
  });

  const {request: deleteBucketEntry} = useApi<BucketDataType>({
    endpoint: "",
    method: "delete",
    deduplicateRequests: false
  });

  const {request: deleteFieldRequest} = useApi({
    endpoint: "",
    method: "put"
  });

  const {request: createBucketEntry, error: apiCreateBucketEntryError} = useApi({
    endpoint: "",
    method: "post"
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
        return await putRequest({body, endpoint: `/api/bucket/${bucket._id}`});
      } catch (err) {
        console.error(err);
      }
    },
    [putRequest]
  );

  const apiDeleteBucket = useCallback(
    (bucketId: string) => {
      return deleteRequest({
        endpoint: `/api/bucket/${bucketId}`
      });
    },
    [deleteRequest]
  );

  const apiUpdateBucketHistory = useCallback(
    async (bucket: BucketType) => {
      return await putRequest({
        endpoint: `/api/bucket/${bucket._id}`,
        body: {
          ...bucket,
          history: !bucket.history
        }
      });
    },
    [patchRequest]
  );

  const apiDeleteBucketHistory = useCallback(
    async (bucket: BucketType) => {
      return await deleteHistoty({
        endpoint: `/api/bucket/${bucket._id}/history`
      });
    },
    [deleteHistoty]
  );

  const apiCreateBucketField = useCallback(
    async (modifiedBucket: BucketType) => {
      return createBucketField({
        body: modifiedBucket,
        endpoint: `/api/bucket/${modifiedBucket._id}`
      });
    },
    [createBucketField]
  );

  const apiUpdateBucketReadonly = useCallback(
    async (bucket: BucketType) => {
      return await putRequest({
        endpoint: `/api/bucket/${bucket._id}`,
        body: {
          ...bucket,
          readOnly: !bucket.readOnly
        }
      });
    },
    [putRequest]
  );

  const apiUpdateBucketRule = useCallback(
    async (bucket: BucketType, newRules: {write: string; read: string}) => {
      return await updateBucketRule({
        endpoint: `/api/bucket/${bucket._id}`,
        body: {...bucket, acl: newRules}
      });
    },
    [updateBucketRule]
  );

  const apiCreateBucket = useCallback(
    (title: string, order: number) => {
      const bucket = {
        title,
        description: "Describe your new bucket",
        icon: "view_stream",
        primary: "title",
        readOnly: false,
        history: false,
        properties: {
          title: {
            type: "string",
            title: "title",
            description: "Title of the row",
            options: {position: "left"}
          },
          description: {
            type: "textarea",
            title: "description",
            description: "Description of the row",
            options: {position: "right"}
          }
        },
        acl: {
          write: "true==true",
          read: "true==true"
        },
        order
      };
      return postRequest({body: {...bucket}});
    },
    [postRequest]
  );

  const apiDeleteBucketEntry = useCallback(
    (entryId: string, bucketId: string) => {
      return deleteBucketEntry({
        endpoint: `/api/bucket/${bucketId}/data/${entryId}`,
      });
    },
    [deleteBucketEntry]
  );

  const apiUpdatebucketLimitiation = useCallback(
    async (bucketId: string, body: BucketType) => {
      return await bucketLimitationRequest({
        endpoint: `/api/bucket/${bucketId}`,
        body
      });
    },
    [bucketLimitationRequest]
  );

  const apiUpdatebucketLimitiationFields = useCallback(
    (bucket: BucketType) => {
      return bucketLimitationRequest({
        endpoint: `/api/bucket/${bucket._id}`,
        body: bucket
      });
    },
    [bucketLimitationRequest]
  );

  const apiCreateBucketEntry = useCallback(
    async (bucketId: string, data: Record<string, any>) => {
      return await createBucketEntry({
        endpoint: `/api/bucket/${bucketId}/data`,
        body: data
      });
    },
    [createBucketEntry]
  );
  
  const apiDeleteBucketField = useCallback(
    (modifiedBucket: BucketType) => {
      return deleteFieldRequest({
        endpoint: `/api/bucket/${modifiedBucket._id}`,
        body: modifiedBucket
      });
    },
    [deleteFieldRequest]
  );

  return {
    apiGetBucketData,
    apiGetBuckets: fetchBuckets,
    apiChangeBucketCategory,
    apiChangeBucketOrder,
    apiRenameBucket,
    apiDeleteBucket,
    apiUpdateBucketHistory,
    apiDeleteBucketHistory,
    apiUpdateBucketReadonly,
    apiUpdateBucketRule,
    apiUpdatebucketLimitiation,
    apiUpdatebucketLimitiationFields,
    apiCreateBucket,
    apiCreateBucketField,
    apiCreateBucketEntry,
    apiDeleteBucketField,
    apiDeleteBucketEntry,
    apiBuckets,
    apiBucketData,
    apiUpdateBucketRuleLoading,
    apiUpdateBucketRuleError,
    apiBucketDataLoading,
    apiDeleteBucketHistoryLoading,
    apiDeleteBucketHistoryError,
    apiUpdateBucketLimitationFieldsLoading,
    apiUpdateBucketLimitationFieldsError,
    apiCreateBucketFieldError,
    apiCreateBucketEntryError
  };
};
