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
  type TypeModal,
  Popover
} from "oziko-ui-kit";
import styles from "./BucketFieldPopup.module.scss";
import BucketAddField from "../../../components/organisms/bucket-add-field/BucketAddField";
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
  onSaveAndClose: (
    type: TypeInputType,
    fieldValues: Record<string, any>,
    configurationValues: Record<string, any>,
    requiredField?: string
  ) => Promise<any> | void;
  bucketAddFieldPopoverStyles?: CSSProperties;
};

const BucketFieldPopup = ({
  children,
  buckets,
  bucket,
  onSaveAndClose,
  bucketAddFieldPopoverStyles
}: BucketFieldPopupProps) => {
  const [selectedType, setSelectedType] = useState<TypeInputType | null>(null);
  const bucketAddFieldRef = useRef<HTMLDivElement>(null);
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
    if (isOpen) {
      setIsOpen(false);
      setTimeout(() => setIsOpen(true), 0);
    } else setIsOpen(true);
  };

  const handleConfigurationClose = () => {
    setSelectedType(null);
  };

  const handleFieldListClose = () => {
    setBucketFieldPopups(bucketFieldPopups.filter(id => id !== bucketFieldPopupId));
    setIsOpen(false);
  };

  const basePortalClassName = bucketFieldPopups.length === 1 ? styles.portalClassName : undefined;
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
            contentProps={{
              className: styles.bucketAddField,
              ref: bucketAddFieldRef,
              style: bucketAddFieldPopoverStyles
            }}
            content={
              <BucketAddField
                name="name"
                type={selectedType as TypeInputType}
                modalProps={{onClose: () => setSelectedType(null)} as TypeModal}
                onSaveAndClose={onSaveAndClose}
                bucket={bucket}
                buckets={buckets}
                innerFieldStyles={innerFieldStyles}
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
