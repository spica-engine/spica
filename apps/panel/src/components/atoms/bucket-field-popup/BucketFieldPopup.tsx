import {
  cloneElement,
  isValidElement,
  memo,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode
} from "react";
import {
  FlexElement,
  ListItem,
  Icon,
  type IconName,
  type TypeInputType,
  Popover
} from "oziko-ui-kit";
import styles from "./BucketFieldPopup.module.scss";
import BucketAddField, {
  type SimpleSaveFieldHandlerArg,
  type SaveFieldHandler
} from "../../../components/organisms/bucket-add-field/BucketAddField";
import type {BucketType} from "src/services/bucketService";
import {useBucketFieldPopups} from "./BucketFieldPopupsContext";

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
  onSaveAndClose: SaveFieldHandler;
  bucketAddFieldPopoverStyles?: CSSProperties;
};

// !!!! relation configi açıkken multiselecte basınca error veriyo
const BucketFieldPopup = ({
  children,
  buckets,
  bucket,
  onSaveAndClose,
  bucketAddFieldPopoverStyles
}: BucketFieldPopupProps) => {
  const [selectedType, setSelectedType] = useState<TypeInputType | null>(null);
  const bucketAddFieldRef = useRef<HTMLDivElement>(null);
  const innerContainerRef = useRef<HTMLDivElement>(null);
  const [innerFieldStyles, setInnerFieldStyles] = useState<CSSProperties>({});
  const [isOpen, setIsOpen] = useState(false);
  const {bucketFieldPopups, setBucketFieldPopups} = useBucketFieldPopups();

  const bucketFieldPopupId = useId();

  useEffect(() => {
    if (!selectedType || !bucketAddFieldRef.current) return;
    const {top, right, left, bottom} = bucketAddFieldRef.current.style;
    const newTop = String(Number(top?.slice(0, -2)) + 10) + "px";
    // Update position styles to ensure the inset is recalculated correctly.
    // We explicitly set both `inset` and the individual sides (`top`, `right`, `bottom`, `left`)
    // because Popover component may ignore or override our values
    setInnerFieldStyles({
      inset: `${newTop} ${right} ${bottom} ${left}`,
      top: newTop,
      right,
      left,
      bottom
    });
  }, [selectedType, bucketAddFieldRef.current]);

  useEffect(() => {
    if (!isOpen || bucketFieldPopups.includes(bucketFieldPopupId)) return;
    setBucketFieldPopups([...bucketFieldPopups, bucketFieldPopupId]);

    return () => {
      if (!bucketFieldPopups.includes(bucketFieldPopupId)) return;
      setBucketFieldPopups(bucketFieldPopups.filter(id => id !== bucketFieldPopupId));
    };
  }, [isOpen, bucketFieldPopupId]);

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(true);
  };

  const fieldOptionsListContainerRef = useRef<HTMLDivElement>(null);

  const handleConfigurationClose = (event?: MouseEvent) => {
    if (event?.target && fieldOptionsListContainerRef.current?.contains(event.target as Node)) {
      return;
    }
    setSelectedType(null);
  };

  const handleFieldListClose = () => {
    setBucketFieldPopups(bucketFieldPopups.filter(id => id !== bucketFieldPopupId));
    setIsOpen(false);
  };

  const handleSaveAndClose = (arg: SimpleSaveFieldHandlerArg) => {
    const maybePromise = onSaveAndClose(arg);

    const runHandlers = () => {
      handleConfigurationClose();
      handleFieldListClose();
    };

    if (maybePromise instanceof Promise) {
      maybePromise.then(res => {
        if (res) runHandlers();
      });
    } else runHandlers();
  };

  const basePortalClassName = (bucketFieldPopups.length === 1 && !!selectedType) ? styles.portalClassName : undefined;
  const outerPortalClassName = `${basePortalClassName} ${bucketFieldPopups[0] === bucketFieldPopupId || !selectedType ? "" : styles.hidden}`;

  return (
    <>
      <Popover
        open={isOpen}
        onClose={handleFieldListClose}
        portalClassName={outerPortalClassName}
        contentProps={{className: styles.popoverContent}}
        content={
          <Popover
            open={!!selectedType}
            onClose={handleConfigurationClose}
            placement="leftStart"
            portalClassName={basePortalClassName}
            containerProps={{ref: innerContainerRef}}
            contentProps={{
              className: styles.bucketAddField,
              ref: bucketAddFieldRef,
              style: bucketAddFieldPopoverStyles
            }}
            content={
              <BucketAddField
                name="name"
                type={selectedType as TypeInputType}
                onSuccess={() => setSelectedType(null)}
                onSaveAndClose={handleSaveAndClose as SaveFieldHandler}
                bucket={bucket}
                buckets={buckets}
                innerFieldStyles={innerFieldStyles}
              />
            }
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
                  onClick={() => setSelectedType(type)}
                  className={styles.item}
                />
              ))}
            </FlexElement>
          </Popover>
        }
      >
        {(isValidElement(children) &&
          typeof children.type !== "string" &&
          cloneElement(children as React.ReactElement<any>, {
            onClick: handleOpen
          })) || <span onClick={handleOpen}>{children}</span>}
      </Popover>
    </>
  );
};

export default memo(BucketFieldPopup);
