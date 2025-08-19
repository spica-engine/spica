import type { TypeInputType, TypeModal } from "oziko-ui-kit";
import type { ReactNode } from "react";
import type { BucketType, Property } from "src/services/bucketService";

export type TypeBucketAddField = {
  name: string;
  type: TypeInputType | "relation";
  modalProps?: TypeModal;
  onSaveAndClose: (fieldProperty: Property, requiredField?: string) => void | Promise<void>;
  bucket: BucketType;
  buckets: BucketType[];
  initialValues?: {
    fieldValues?: Record<string, any>;
    configurationValue?: Record<string, any>;
  };
};

export type TypeBucketFieldCreator = {
  type: TypeInputType | "relation";
  fieldValues: Record<string, any>;
  setFieldValues: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  configurationValue: Record<string, any>;
  bucket?: BucketType;
  buckets: BucketType[];
  inputRepresenter: ReactNode;
  configuration: ReactNode;
  onSaveAndClose: (fieldProperty: Property, requiredField?: string) => void | Promise<void>;
  handleClose: () => void;
};

export type EditInnerFieldProps = {
  name: string;
  type: TypeInputType | "relation";
  onSaveAndClose: (fieldProperty: Property, requiredField?: string) => void | Promise<void>;
  bucket: BucketType;
  buckets: BucketType[];
  fieldValues?: Record<string, any>;
  configurationValue?: Record<string, any>;
};