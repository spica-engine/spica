import {useCallback} from "react";
import useApi from "../hooks/useApi";

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

export const useBucketService = () => {
  const {request, data, error, loading} = useApi<BucketType[]>({
    endpoint: "/api/bucket",
    method: "get"
  });

  const {request: patchRequest} = useApi({endpoint: "/api/bucket", method: "patch"});

  const requestCategoryChange = useCallback((bucketId: string, category: string) => {
    return patchRequest({body: {category}, endpoint: `/api/bucket/${bucketId}`});
  }, []);

  return {
    buckets: data,
    fetchBuckets: request,
    error,
    loading,
    requestCategoryChange
  };
};
