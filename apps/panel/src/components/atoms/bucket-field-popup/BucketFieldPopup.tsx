import {memo, useCallback, useState, type ReactNode} from "react";
import {
  FlexElement,
  ListItem,
  Icon,
  type IconName,
  type TypeInputType,
  Popover,
  type TypeModal
} from "oziko-ui-kit";
import styles from "./BucketFieldPopup.module.scss";
import BucketAddField from "../../../components/organisms/bucket-add-field/BucketAddField";
import type {BucketType, Property} from "src/services/bucketService";

export const fieldOptions: {icon: IconName; text: string; type: TypeInputType | "relation"}[] = [
  {icon: "formatQuoteClose", text: "String", type: "string"},
  {icon: "numericBox", text: "Number", type: "number"},
  {icon: "calendarBlank", text: "Date", type: "date"},
  {icon: "checkboxBlankOutline", text: "Boolean", type: "boolean"},
  {icon: "formatColorText", text: "Textarea", type: "textarea"},
  {icon: "formatListChecks", text: "Multiple Selection", type: "multiselect"},
  {icon: "callMerge", text: "Relation", type: "relation"},
  {icon: "mapMarker", text: "Location", type: "location"},
  {icon: "ballot", text: "Array", type: "array"},
  {icon: "dataObject", text: "Object", type: "object"},
  {icon: "imageMultiple", text: "File", type: "storage"},
  {icon: "formatAlignCenter", text: "Richtext", type: "richtext"}
];

const BucketFieldPopup = ({
  children,
  buckets,
  bucket,
  onSaveAndClose
}: {
  children: ReactNode;
  buckets: BucketType[];
  bucket: BucketType;
  onSaveAndClose: (fieldProperty: Property, requiredField?: string) => void;
}) => {
  const [selectedType, setSelectedType] = useState<TypeInputType | "relation" | null>(null);

  return (
    <>
      <Popover
        contentProps={{className: styles.popoverContent}}
        content={
          <FlexElement dimensionX={200} direction="vertical" className={styles.container}>
            {fieldOptions.map(({icon, text, type}) => (
              <ListItem
                key={text}
                label={text}
                dimensionX="fill"
                dimensionY="hug"
                gap={10}
                prefix={{children: <Icon name={icon} />}}
                onClick={() => setSelectedType(type)}
                className={styles.item}
              />
            ))}
          </FlexElement>
        }
      >
        {children}
      </Popover>
      {selectedType && bucket && (
        <BucketAddField
          name="name"
          type={selectedType}
          modalProps={{onClose: () => setSelectedType(null)} as TypeModal}
          onSaveAndClose={onSaveAndClose}
          bucket={bucket}
          buckets={buckets}
        />
      )}
    </>
  );
};

export default memo(BucketFieldPopup);
