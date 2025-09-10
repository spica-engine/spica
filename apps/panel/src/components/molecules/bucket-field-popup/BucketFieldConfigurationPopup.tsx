import {memo, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode} from "react";
import {type IconName, type TypeInputType, Popover} from "oziko-ui-kit";
import styles from "./BucketFieldPopup.module.scss";
import BucketAddField from "../../organisms/bucket-add-field/BucketAddField";
import type {BucketType} from "src/services/bucketService";
import type {FormValues} from "../../../components/organisms/bucket-add-field/BucketAddFieldBusiness";
import {useBucketFieldPopups} from "./BucketFieldPopupsContext";
import type {
  configPropertiesMapping,
  innerFieldConfigProperties
} from "../../../components/organisms/bucket-add-field/BucketAddFieldSchema";

type BucketFieldConfigurationPopupProps = {
  selectedType: TypeInputType | null;
  bucket: BucketType;
  buckets: BucketType[];
  onClose: (event?: MouseEvent) => void;
  onSaveAndClose: (values: FormValues) => void;
  bucketAddFieldPopoverStyles: CSSProperties;
  children: ReactNode;
  isOpen: boolean;
  initialValues?: FormValues;
  setBucketFieldPopupId?: React.Dispatch<React.SetStateAction<string | undefined>>;
  iconName?: IconName;
  configurationMapping: typeof configPropertiesMapping | typeof innerFieldConfigProperties;
  forbiddenFieldNames?: string[];
};

const BucketFieldConfigurationPopup = ({
  selectedType,
  bucket,
  buckets,
  onClose,
  onSaveAndClose,
  bucketAddFieldPopoverStyles,
  children,
  isOpen,
  initialValues,
  setBucketFieldPopupId,
  iconName,
  configurationMapping,
  forbiddenFieldNames
}: BucketFieldConfigurationPopupProps) => {
  const innerContainerRef = useRef<HTMLDivElement>(null);
  const bucketAddFieldRef = useRef<HTMLDivElement>(null);
  const [innerFieldStyles, setInnerFieldStyles] = useState<CSSProperties>({});
  const {setBucketFieldPopups, bucketFieldPopups} = useBucketFieldPopups();
  const id = useId();
  const popupStackEmpty = bucketFieldPopups.length === 0;
  const isFirstPopup = popupStackEmpty || bucketFieldPopups[0] === id;
  const isLastPopup = bucketFieldPopups.at(-1) === id;

  const offsetX = isFirstPopup ? 200 : 0;
  const offsetY = isFirstPopup ? 0 : 10;

  useEffect(() => {
    if (!isOpen || !bucketAddFieldRef.current) return;
    const {top, right, left, bottom} = bucketAddFieldRef.current.style;
    // Update position styles to ensure the inset is recalculated correctly.
    // We explicitly set both `inset` and the individual sides (`top`, `right`, `bottom`, `left`)
    // because Popover component may ignore or override our values
    setInnerFieldStyles({
      inset: `${top} ${right} ${bottom} ${left}`,
      top,
      right,
      left,
      bottom,
      transform: "translate(200px, 10px)"
    });
  }, [isOpen, bucketAddFieldRef.current]);

  useEffect(() => {
    if (!isOpen) return;
    setBucketFieldPopups(prev => [...prev, id]);
    return () => {
      setBucketFieldPopups(prev => prev.filter(popupId => popupId !== id));
    };
  }, [isOpen]);

  useEffect(() => setBucketFieldPopupId?.(id), [id]);



  return (
    <Popover
      open={isOpen}
      onClose={onClose}
      placement="leftStart"
      containerProps={{ref: innerContainerRef}}
      contentProps={{
        className: `${styles.bucketAddField} ${!isLastPopup ? styles.lowBrightness : ""}`,
        ref: bucketAddFieldRef,
        style: {
          transform: `translate(${offsetX}px, ${offsetY}px)`,
          ...bucketAddFieldPopoverStyles,
        }
      }}
      content={
        <BucketAddField
          type={selectedType as TypeInputType}
          onSuccess={onClose}
          onSaveAndClose={onSaveAndClose}
          bucket={bucket}
          buckets={buckets}
          innerFieldStyles={innerFieldStyles}
          initialValues={initialValues}
          iconName={iconName}
          configurationMapping={configurationMapping}
          forbiddenFieldNames={forbiddenFieldNames}
        />
      }
    >
      {children}
    </Popover>
  );
};

export default memo(BucketFieldConfigurationPopup);
