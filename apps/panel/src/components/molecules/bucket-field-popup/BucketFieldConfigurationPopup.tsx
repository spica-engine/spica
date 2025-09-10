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
import {type IconName, type TypeInputType, Popover} from "oziko-ui-kit";
import styles from "./BucketFieldPopup.module.scss";
import BucketAddField from "../../organisms/bucket-add-field/BucketAddField";
import type {FormValues} from "../../../components/organisms/bucket-add-field/BucketAddFieldBusiness";
import {useBucketFieldPopups} from "./BucketFieldPopupsContext";
import {
  configPropertiesMapping,
  innerFieldConfigProperties
} from "../../../components/organisms/bucket-add-field/BucketAddFieldSchema";
import type {PopupType} from "./BucketFieldPopupsContext";

type BucketFieldConfigurationPopupProps = {
  selectedType: TypeInputType | null;
  onClose: (event?: MouseEvent) => void;
  onSaveAndClose: (values: FormValues) => void;
  children: ReactNode;
  isOpen: boolean;
  initialValues?: FormValues;
  setBucketFieldPopupId?: React.Dispatch<React.SetStateAction<string | undefined>>;
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
  setBucketFieldPopupId,
  iconName,
  popupType
}: BucketFieldConfigurationPopupProps) => {
  const innerContainerRef = useRef<HTMLDivElement>(null);
  const bucketAddFieldRef = useRef<HTMLDivElement>(null);
  const [innerFieldStyles, setInnerFieldStyles] = useState<CSSProperties>({});

  const {setBucketFieldPopups, bucketFieldPopups} = useBucketFieldPopups();
  const id = useId();
  const popupStackEmpty = bucketFieldPopups.length === 0;
  const isFirstPopup = popupStackEmpty || bucketFieldPopups[0].id === id;
  const isLastPopup = popupStackEmpty || bucketFieldPopups.at(-1)?.id === id;

  const offsetX = isFirstPopup ? 200 : 0;
  const offsetY = isFirstPopup ? 0 : 10;
  const configurationMapping = isFirstPopup ? configPropertiesMapping : innerFieldConfigProperties;

  const isPopupRegistered = useMemo(
    () => bucketFieldPopups.some(p => p.id === id),
    [bucketFieldPopups]
  );

  const bucketAddFieldPopoverStyles = useMemo<CSSProperties>(() => {
    if (isFirstPopup) return {};
    return (
      bucketFieldPopups[bucketFieldPopups.findIndex(i => i.id === id) - 1]?.innerFieldStyles ?? {}
    );
  }, [isFirstPopup, bucketFieldPopups]);

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
        fieldType: selectedType,
        iconName,
        popupType,
        configurationMapping,
        initialValues
      }
    ]);
    console.log("popup registered", {
      id,
      innerFieldStyles,
      selectedType,
      iconName,
      popupType,
      configurationMapping
    });
    return () => {
      setBucketFieldPopups(prev => prev.filter(popup => popup.id !== id));
    };
  }, [isOpen, innerFieldStyles]);

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
          ...bucketAddFieldPopoverStyles
        }
      }}
      content={
        isPopupRegistered && (
          <BucketAddField onSuccess={onClose} onSaveAndClose={onSaveAndClose} popupId={id} />
        )
      }
    >
      {children}
    </Popover>
  );
};

export default memo(BucketFieldConfigurationPopup);
