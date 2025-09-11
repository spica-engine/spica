import {
  memo,
  useEffect,
  useId,
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
import type {FormValues} from "../../../components/organisms/bucket-add-field/BucketAddFieldBusiness";
import {useBucketFieldPopups} from "./BucketFieldPopupsContext";
import type {PopupType} from "./BucketFieldPopupsContext";

type BucketFieldConfigurationPopupProps = {
  selectedType: FieldKind | null;
  onClose: (event?: MouseEvent) => void;
  onSaveAndClose: (values: FormValues) => void;
  children: ReactNode;
  isOpen: boolean;
  initialValues?: FormValues;
  onRegister?: (id: string) => void;
  iconName?: IconName;
  popupType?: PopupType;
};

const BucketFieldConfigurationPopup = ({
  selectedType,
  onClose,
  onSaveAndClose,
  children,
  isOpen,
  initialValues,
  onRegister,
  iconName,
  popupType
}: BucketFieldConfigurationPopupProps) => {
  const innerContainerRef = useRef<HTMLDivElement>(null);
  const bucketAddFieldRef = useRef<HTMLDivElement>(null);
  const [innerFieldStyles, setInnerFieldStyles] = useState<CSSProperties>({});

  const {setBucketFieldPopups, bucketFieldPopups} = useBucketFieldPopups();
  const id = useId();

  const {isLastPopup, offsetX, offsetY, configurationMapping, bucketAddFieldPopoverStyles} =
    useMemo(() => {
      const popupStackEmpty = bucketFieldPopups.length === 0;
      const isFirstPopup = popupStackEmpty || bucketFieldPopups[0]?.id === id;
      const isLastPopup = popupStackEmpty || bucketFieldPopups.at(-1)?.id === id;
      const offsetX = isFirstPopup ? 200 : 0;
      const offsetY = isFirstPopup ? 0 : 10;
  const configurationMapping = {}; // configuration now derived in Business component
      const bucketAddFieldPopoverStyles = isFirstPopup
        ? {}
        : bucketFieldPopups[bucketFieldPopups.findIndex(i => i.id === id) - 1]?.innerFieldStyles ||
          {};

      return {
        isLastPopup,
        offsetX,
        offsetY,
  configurationMapping: undefined,
        bucketAddFieldPopoverStyles
      };
    }, [bucketFieldPopups, id]);

  const isPopupRegistered = useMemo(
    () => bucketFieldPopups.some(p => p.id === id),
    [bucketFieldPopups]
  );

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
    setBucketFieldPopups(prev => [
      ...prev,
      {
        id,
        innerFieldStyles,
        fieldKind: selectedType || undefined,
        iconName,
        popupType,
        initialValues
      }
    ]);
    onRegister?.(id);
    return () => {
      setBucketFieldPopups(prev => prev.filter(popup => popup.id !== id));
    };
  }, [isOpen, innerFieldStyles]);

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
          ...bucketAddFieldPopoverStyles
        }
      }}
      content={
        isPopupRegistered && (
          <BucketAddField onSuccess={onClose} onSaveAndClose={onSaveAndClose} popupId={id} />
        )
      }
    >
      {children as any}
    </Popover>
  );
};

export default memo(BucketFieldConfigurationPopup);
