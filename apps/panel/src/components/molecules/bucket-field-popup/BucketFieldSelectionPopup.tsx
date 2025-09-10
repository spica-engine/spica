import {cloneElement, memo, useRef, useState, type CSSProperties, type ReactNode} from "react";
import {
  FlexElement,
  ListItem,
  Icon,
  type TypeInputType,
  Popover,
  type IconName
} from "oziko-ui-kit";
import styles from "./BucketFieldPopup.module.scss";
import type {BucketType} from "src/services/bucketService";
import type {FormValues} from "../../../components/organisms/bucket-add-field/BucketAddFieldBusiness";
import {useBucketFieldPopups} from "./BucketFieldPopupsContext";
import BucketFieldConfigurationPopup from "./BucketFieldConfigurationPopup";
import {
  configPropertiesMapping,
  type innerFieldConfigProperties
} from "../../../components/organisms/bucket-add-field/BucketAddFieldSchema";
import type { Placement } from "oziko-ui-kit/dist/custom-hooks/useAdaptivePosition";

export const fieldOptions: {icon: IconName; text: string; type: TypeInputType | "json"}[] = [
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
  {icon: "formatAlignCenter", text: "Richtext", type: "richtext"},
  {icon: "dataObject", text: "JSON", type: "json"}
];

type BucketFieldSelectionPopupProps = {
  children: ReactNode;
  buckets: BucketType[];
  bucket: BucketType;
  onSaveAndClose: (values: FormValues) => void | Promise<any>;
  bucketAddFieldPopoverStyles?: CSSProperties;
  configurationMapping?: typeof configPropertiesMapping | typeof innerFieldConfigProperties;
  iconName?: IconName;
  forbiddenFieldNames?: string[];
  placement?: Placement;
};

const BucketFieldSelectionPopup = ({
  children,
  buckets,
  bucket,
  onSaveAndClose,
  bucketAddFieldPopoverStyles,
  configurationMapping = configPropertiesMapping,
  iconName,
  forbiddenFieldNames,
  placement,
}: BucketFieldSelectionPopupProps) => {
  const [selectedType, setSelectedType] = useState<TypeInputType | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const {bucketFieldPopups, setBucketFieldPopups} = useBucketFieldPopups();
  const fieldOptionsListContainerRef = useRef<HTMLDivElement>(null);

  const [bucketFieldPopupId, setBucketFieldPopupId] = useState<string>();

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(true);
  };

  const handleClose = () => {
    setBucketFieldPopups(bucketFieldPopups.filter(id => id !== bucketFieldPopupId));
    setIsOpen(false);
    setSelectedType(null);
  };

  const handleTypeSelect = (type: TypeInputType) => {
    setSelectedType(type);
  };

  const handleConfigurationClose = (event?: MouseEvent) => {
    if (event?.target && fieldOptionsListContainerRef.current?.contains(event.target as Node)) {
      return;
    }
    setSelectedType(null);
  };

  const handleSaveAndClose = (values: FormValues) => {
    const maybePromise = onSaveAndClose(values);

    const runHandlers = () => {
      setSelectedType(null);
      handleClose();
    };

    if (maybePromise instanceof Promise) {
      maybePromise.then(res => {
        if (res) runHandlers();
      });
    } else runHandlers();
  };

  const outerPortalClassName = `${!selectedType ? "" : styles.hidden}`;

  return (
    <Popover
      placement={placement}
      open={isOpen}
      onClose={handleClose}
      portalClassName={outerPortalClassName}
      contentProps={{className: styles.popoverContent}}
      content={
        <BucketFieldConfigurationPopup
          isOpen={!!selectedType}
          selectedType={selectedType}
          bucket={bucket}
          buckets={buckets}
          onClose={handleConfigurationClose}
          onSaveAndClose={handleSaveAndClose}
          bucketAddFieldPopoverStyles={bucketAddFieldPopoverStyles ?? {}}
          setBucketFieldPopupId={setBucketFieldPopupId}
          configurationMapping={configurationMapping}
          iconName={iconName}
          forbiddenFieldNames={forbiddenFieldNames}
        >
          <FlexElement
            ref={fieldOptionsListContainerRef}
            dimensionX={200}
            direction="vertical"
            className={styles.container}
          >
            {fieldOptions.map(({icon, text, type}) => (
              <ListItem
                key={text}
                label={text}
                dimensionX="fill"
                dimensionY="hug"
                gap={10}
                prefix={{children: <Icon name={icon} />}}
                onClick={() => handleTypeSelect(type as TypeInputType)}
                className={styles.item}
              />
            ))}
          </FlexElement>
        </BucketFieldConfigurationPopup>
      }
    >
      {cloneElement(children as React.ReactElement<{onClick?: (e: React.MouseEvent) => void}>, {
        onClick: handleOpen
      })}
    </Popover>
  );
};

export default memo(BucketFieldSelectionPopup);
