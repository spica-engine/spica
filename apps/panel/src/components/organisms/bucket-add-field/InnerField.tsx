import { FluidContainer, FlexElement, Icon, Button, type TypeModal, Text, type TypeInputType } from "oziko-ui-kit";
import { useCallback, type FC, useState } from "react";
import type { Property, BucketType } from "src/services/bucketService";
import BucketAddField from "./BucketAddField";
import styles from "./BucketAddField.module.scss";

export type EditInnerFieldProps = {
  name: string;
  type: TypeInputType | "relation";
  onSaveAndClose: (fieldProperty: Property, requiredField?: string) => void | Promise<void>;
  bucket: BucketType;
  buckets: BucketType[];
  fieldValues?: Record<string, any>;
  configurationValue?: Record<string, any>;
};

type InnerFieldProps = {
  field: Property;
  bucket?: BucketType;
  buckets: BucketType[];
  setFieldValues: React.Dispatch<React.SetStateAction<Record<string, any>>>;
};

export const InnerField = ({field, bucket, buckets, setFieldValues}: InnerFieldProps) => {
  const handleSaveInnerField = useCallback((fieldProperty: Property) => {
    setFieldValues(prev => ({
      ...prev,
      innerFields: prev.innerFields?.map((innerField: Record<string, any>) =>
        innerField.title === fieldProperty.title ? fieldProperty : innerField
      )
    }));
  }, []);

  const handleDeleteInnerField = useCallback((field: Property) => {
    setFieldValues(prev => ({
      ...prev,
      innerFields: prev.innerFields?.filter((innerField: Record<string, any>) => innerField.title !== field.title)
    }));
  }, []);

  return (
    <FluidContainer
      dimensionX="fill"
      className={styles.innerFieldItem}
      prefix={{
        children: (
          <FlexElement gap={5} className={styles.innerFieldPrefix}>
            <Icon name={"chevronRight"} size="sm" />
            <Text className={styles.innerFieldName}>{field.title}</Text>
          </FlexElement>
        )
      }}
      root={{children: <Text>{field.type}</Text>}}
      suffix={{
        children: (
          <FlexElement gap={5} dimensionX="fill" className={styles.innerFieldActions}>
            <EditInnerField
              name={field.title}
              type={field.type}
              onSaveAndClose={handleSaveInnerField}
              bucket={bucket as BucketType}
              buckets={buckets}
              fieldValues={field}
            />
            <Button color="danger" variant="icon" onClick={() => handleDeleteInnerField(field)}>
              <Icon name="delete" />
            </Button>
          </FlexElement>
        )
      }}
    />
  );
};

const EditInnerField: FC<EditInnerFieldProps> = ({
  name,
  type,
  onSaveAndClose,
  bucket,
  buckets,
  fieldValues,
  configurationValue
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button color="default" variant="icon" onClick={() => setIsOpen(true)}>
        <Icon name="pencil" />
      </Button>
      {isOpen && (
        <BucketAddField
          name={name}
          type={type}
          onSaveAndClose={onSaveAndClose}
          bucket={bucket}
          buckets={buckets}
          initialValues={{
            fieldValues: fieldValues,
            configurationValue: configurationValue
          }}
          modalProps={{onClose: () => setIsOpen(false)} as TypeModal}
        />
      )}
    </>
  );
};