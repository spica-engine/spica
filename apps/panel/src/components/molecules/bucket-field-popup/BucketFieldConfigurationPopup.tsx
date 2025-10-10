import {
  memo,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode
} from "react";
import {type IconName, Popover} from "oziko-ui-kit";
import {FieldKind} from "../../../domain/fields";
import styles from "./BucketFieldPopup.module.scss";
import BucketAddField from "../../organisms/bucket-add-field/BucketAddField";
import {useBucketFieldPopups} from "./BucketFieldPopupsContext";
import type {PopupType} from "./BucketFieldPopupsContext";
import type {FieldFormState} from "../../../domain/fields/types";
import type {Placement} from "oziko-ui-kit/dist/custom-hooks/useAdaptivePosition";

type BucketFieldConfigurationPopupProps = {
  selectedType: FieldKind | null;
  onClose: (event?: MouseEvent) => void;
  onSaveAndClose: (values: FieldFormState) => void;
  children: ReactNode;
  isOpen: boolean;
  initialValues?: FieldFormState;
  iconName?: IconName;
  popupType?: PopupType;
  forbiddenFieldNames?: string[];
  popoverClassName?: string;
  popoverContentStyles?: CSSProperties;
  externalBucketAddFieldRef?: React.RefObject<HTMLDivElement>;
};

const BucketFieldConfigurationPopup = ({
  selectedType,
  onClose,
  onSaveAndClose,
  children,
  isOpen,
  initialValues,
  iconName,
  popupType,
  forbiddenFieldNames,
  popoverClassName,
  popoverContentStyles,
  externalBucketAddFieldRef
}: BucketFieldConfigurationPopupProps) => {
  const innerContainerRef = useRef<HTMLDivElement>(null);
  const bucketAddFieldRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(
    externalBucketAddFieldRef ?? {current: null},
    () => bucketAddFieldRef.current as HTMLDivElement
  );

  const [innerFieldStyles, setInnerFieldStyles] = useState<CSSProperties>({});

  const {setBucketFieldPopups, bucketFieldPopups} = useBucketFieldPopups();
  const id = useId();

  const {isLastPopup, offsetX, offsetY, bucketAddFieldPopoverStyles, isPopupRegistered} =
    useMemo(() => {
      const isPopupRegistered = bucketFieldPopups.some(p => p.id === id);
      const popupStackEmpty = bucketFieldPopups.length === 0;
      const isFirstPopup = popupStackEmpty || bucketFieldPopups[0]?.id === id;
      const isLastPopup = popupStackEmpty || bucketFieldPopups.at(-1)?.id === id;
      const offsetX = isFirstPopup ? 200 : 0;
      const offsetY = isFirstPopup ? 0 : 10;

      const parentPopupIndex = bucketFieldPopups.findIndex(p => p.id === id) - 1;
      const innerFieldStyles = bucketFieldPopups[parentPopupIndex]?.innerFieldStyles || {};
      const bucketAddFieldPopoverStyles = isFirstPopup ? {} : innerFieldStyles;

      return {
        isLastPopup,
        offsetX,
        offsetY,
        bucketAddFieldPopoverStyles,
        isPopupRegistered
      };
    }, [bucketFieldPopups, id]);

  useEffect(() => {
    if (!isOpen || !bucketAddFieldRef.current || !isPopupRegistered) return;
    const {top, right, left, bottom} = bucketAddFieldRef.current.style;
    const popupOrder = bucketFieldPopups.findIndex(p => p.id === id) + 1;
    // Update position styles to ensure the inset is recalculated correctly.
    // We explicitly set both `inset` and the individual sides (`top`, `right`, `bottom`, `left`)
    // because Popover component may ignore or override our values
    setInnerFieldStyles({
      inset: `${top} ${right} ${bottom} ${left}`,
      top,
      right,
      left,
      bottom,
      transform: `translate(200px, ${popupOrder * 10}px)`
    });
  }, [isOpen, bucketAddFieldRef.current, isPopupRegistered]);

  useEffect(() => {
    if (!isOpen) return;
    const newBucketFieldPopup = {
      id,
      innerFieldStyles,
      fieldKind: selectedType || undefined,
      iconName,
      popupType,
      initialValues,
      forbiddenFieldNames: forbiddenFieldNames ?? []
    };
    setBucketFieldPopups(prev => [...prev, newBucketFieldPopup]);
    return () => {
      setBucketFieldPopups(prev => prev.filter(popup => popup.id !== id));
    };
  }, [isOpen, innerFieldStyles]);

  const handleClose = (e?: MouseEvent) => {
    setBucketFieldPopups(bucketFieldPopups.filter(popup => popup.id !== id));
    onClose(e);
  };

  return (
    <Popover
      open={isOpen}
      onClose={handleClose}
      placement="leftStart"
      containerProps={{ref: innerContainerRef, className: popoverClassName || ""}}
      contentProps={{
        className: `${styles.bucketAddField} ${!isLastPopup ? styles.hidden : ""}`,
        ref: bucketAddFieldRef,
        style: {
          transform: `translate(${offsetX}px, ${offsetY}px)`,
          ...bucketAddFieldPopoverStyles,
          ...(popoverContentStyles ?? {})
        }
      }}
      content={
        isPopupRegistered && (
          <BucketAddField
            onClose={handleClose}
            onSaveAndClose={onSaveAndClose}
            popupId={id}
            forbiddenFieldNames={forbiddenFieldNames}
          />
        )
      }
    >
      {children}
    </Popover>
  );
};

export default memo(BucketFieldConfigurationPopup);
