import {memo, useState, type ReactNode} from "react";
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
import type {BucketType} from "src/services/bucketService";

export const fieldOptions: {icon: IconName; text: string; type: TypeInputType}[] = [
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

type BucketFieldPopupProps = {
  children: ReactNode;
  buckets: BucketType[];
  bucket: BucketType;
  onSaveAndClose: (
    type: TypeInputType,
    fieldValues: Record<string, any>,
    configurationValues: Record<string, any>,
    requiredField?: string
  ) => Promise<any> | void;
  bucketAddFieldPopoverClassName?: string;
};

const BucketFieldPopup = ({
  children,
  buckets,
  bucket,
  onSaveAndClose,
  bucketAddFieldPopoverClassName
}: BucketFieldPopupProps) => {
  const [selectedType, setSelectedType] = useState<TypeInputType | null>(null);

  return (
    <>
      <Popover
        open={!!selectedType}
        portalClassName={styles.portalClassName}
        contentProps={{className: styles.popoverContent}}
        content={
          <Popover
            placement="leftStart"
            portalClassName={styles.portalClassName}
            contentProps={{
              className: `${styles.bucketAddField} ${bucketAddFieldPopoverClassName || ""}`
            }}
            content={
              <BucketAddField
                name="name"
                type={selectedType as TypeInputType}
                modalProps={{onClose: () => setSelectedType(null)} as TypeModal}
                onSaveAndClose={onSaveAndClose}
                bucket={bucket}
                buckets={buckets}
              />
            }
          >
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
          </Popover>
        }
      >
        {children}
      </Popover>
    </>
  );
};

export default memo(BucketFieldPopup);
