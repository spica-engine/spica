import {
  memo,
  useEffect,
  useId,
  useRef,
  useState,
  useCallback,
  type ReactNode
} from "react";
import {type IconName, Popover} from "oziko-ui-kit";
import {FieldKind} from "../../../domain/fields";
import styles from "./BucketFieldPopup.module.scss";
import BucketAddField from "../../organisms/bucket-add-field/BucketAddField";
import type {FieldFormState} from "../../../domain/fields/types";
import {usePopoverStack, type InsetValue} from "../../../hooks/usePopoverStack";

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
  parentInset?: InsetValue | null;
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
  parentInset
}: BucketFieldConfigurationPopupProps) => {
  const innerContainerRef = useRef<HTMLDivElement>(null);
  const bucketAddFieldRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const {registerPopover, unregisterPopover, getInset, formatInset} = usePopoverStack();
  const [popoverId, setPopoverId] = useState<string | null>(null);
  const [insetStyle, setInsetStyle] = useState<React.CSSProperties>({});

  const handleClose = useCallback(
    (e?: MouseEvent) => {
      onClose(e);
      // Unregister popover when closing
      if (popoverId) {
        unregisterPopover(popoverId);
        setPopoverId(null);
      }
    },
    [onClose, popoverId, unregisterPopover]
  );


  useEffect(() => {
    if (isOpen && !popoverId) {
      const popoverWidth = 400;
      const popoverHeight = 600;

      let baseInset: InsetValue | undefined;
      if (parentInset) {
        const selectionPopoverWidth = 200;
        const widthDifference = popoverWidth - selectionPopoverWidth;

        baseInset = {
          top: parentInset.top,
          right: Math.max(8, parentInset.right - widthDifference),
          bottom: parentInset.bottom,
          left: parentInset.left
        };

        const minRight = 8;
        if (baseInset.right < minRight) {
          const adjustment = minRight - baseInset.right;
          baseInset.left = Math.max(8, baseInset.left - adjustment);
          baseInset.right = minRight;
        }
      }

      const {popoverId: newPopoverId, inset} = registerPopover(baseInset, popoverWidth, popoverHeight);
      setPopoverId(newPopoverId);
      setInsetStyle({
        inset: formatInset(inset),
        position: "fixed" as const
      });
    } else if (!isOpen && popoverId) {
      unregisterPopover(popoverId);
      setPopoverId(null);
    }
  }, [isOpen, popoverId, parentInset, registerPopover, unregisterPopover, formatInset]);

  useEffect(() => {
    return () => {
      if (popoverId) {
        unregisterPopover(popoverId);
      }
    };
  }, [popoverId, unregisterPopover]);

  useEffect(() => {
    if (popoverId && isOpen) {
      const inset = getInset(popoverId);
      if (inset) {
        setInsetStyle({
          inset: formatInset(inset),
          position: "fixed" as const
        });
      }
    }
  }, [popoverId, isOpen, getInset, formatInset]);

  return (
    <Popover
      open={isOpen}
      onClose={handleClose}
      containerProps={{
        ref: innerContainerRef,
        className: popoverClassName || ""
      }}
      contentProps={{
        className: styles.bucketAddField,
        ref: bucketAddFieldRef,
        style: insetStyle,
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
