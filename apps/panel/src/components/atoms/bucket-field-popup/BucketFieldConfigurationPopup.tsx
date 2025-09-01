import {memo, useEffect, useRef, useState, type CSSProperties, type ReactNode} from "react";
import {type TypeInputType, Popover} from "oziko-ui-kit";
import styles from "./BucketFieldPopup.module.scss";
import BucketAddField from "../../../components/organisms/bucket-add-field/BucketAddField";
import type {BucketType} from "src/services/bucketService";
import type {FormValues} from "src/components/organisms/bucket-add-field/BucketAddFieldBusiness";

type BucketFieldConfigurationPopupProps = {
  selectedType: TypeInputType | null;
  bucket: BucketType;
  buckets: BucketType[];
  onClose: (event?: MouseEvent) => void;
  onSaveAndClose: (values: FormValues) => void;
  bucketAddFieldPopoverStyles: CSSProperties;
  basePortalClassName?: string;
  children: ReactNode;
  isOpen: boolean;
  initialValues?: FormValues;
};

const BucketFieldConfigurationPopup = ({
  selectedType,
  bucket,
  buckets,
  onClose,
  onSaveAndClose,
  bucketAddFieldPopoverStyles,
  basePortalClassName,
  children,
  isOpen,
  initialValues,
}: BucketFieldConfigurationPopupProps) => {
  const innerContainerRef = useRef<HTMLDivElement>(null);
  const bucketAddFieldRef = useRef<HTMLDivElement>(null);
  const [innerFieldStyles, setInnerFieldStyles] = useState<CSSProperties>({});

  useEffect(() => {
    if (!isOpen || !bucketAddFieldRef.current) return;
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
  }, [isOpen, bucketAddFieldRef.current]);

  const handleSuccess = () => {
    onClose();
  };

  return (
    <Popover
      open={isOpen}
      onClose={onClose}
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
          type={selectedType as TypeInputType}
          onSuccess={handleSuccess}
          onSaveAndClose={onSaveAndClose}
          bucket={bucket}
          buckets={buckets}
          innerFieldStyles={innerFieldStyles}
          initialValues={initialValues}
        />
      }
    >
      {children as any}
    </Popover>
  );
};

export default memo(BucketFieldConfigurationPopup);
