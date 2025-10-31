import {
  memo,
  useEffect,
  useId,
  useRef,
  type ReactNode
} from "react";
import {type IconName, Popover} from "oziko-ui-kit";
import {FieldKind} from "../../../domain/fields";
import styles from "./BucketFieldPopup.module.scss";
import BucketAddField from "../../organisms/bucket-add-field/BucketAddField";
import type {FieldFormState} from "../../../domain/fields/types";

export type PopupType = "add-field" | "edit-inner-field" | "add-inner-field";

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
  popoverClassName
}: BucketFieldConfigurationPopupProps) => {
  const innerContainerRef = useRef<HTMLDivElement>(null);
  const bucketAddFieldRef = useRef<HTMLDivElement>(null);
  const id = useId();

  const handleClose = (e?: MouseEvent) => {
    onClose(e);
  };

  return (
    <Popover
      open={isOpen}
      onClose={handleClose}
      placement="leftStart"
      containerProps={{ref: innerContainerRef, className: popoverClassName || ""}}
      contentProps={{
        className: styles.bucketAddField,
        ref: bucketAddFieldRef,
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
        }
      }}
      content={
        isOpen && selectedType && (
          <BucketAddField
            onClose={handleClose}
            onSaveAndClose={onSaveAndClose}
            popupId={id}
            forbiddenFieldNames={forbiddenFieldNames}
            fieldType={selectedType}
            popupType={popupType}
            initialValues={initialValues}
          />
        )
      }
    >
      {children}
    </Popover>
  );
};

export default memo(BucketFieldConfigurationPopup);
