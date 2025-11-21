import {memo, useState, useEffect, useCallback, useRef, type ReactNode} from "react";
import {FlexElement, ListItem, Icon, Popover} from "oziko-ui-kit";
import styles from "./BucketFieldPopup.module.scss";
import BucketFieldConfigurationPopup, {type PopupType} from "./BucketFieldConfigurationPopup";
import {FieldKind} from "../../../domain/fields";
import {FIELD_REGISTRY} from "../../../domain/fields/registry";
import type {FieldFormState} from "../../../domain/fields/types";
import type {BucketType} from "../../../store/api/bucketApi";
import {usePopoverStack, type InsetValue} from "../../../hooks/usePopoverStack";

type BucketFieldSelectionPopupProps = {
  children: (props: {onOpen: (e: React.MouseEvent) => void} & {className?: string}) => ReactNode;
  onSaveAndClose: (values: FieldFormState, kind: FieldKind) => void | Promise<BucketType>;
  popupType?: PopupType;
  forbiddenFieldNames?: string[];
  containerClassName?: string;
};

const BucketFieldSelectionPopup = ({
  children,
  onSaveAndClose,
  popupType = "add-field",
  forbiddenFieldNames = [],
  containerClassName
}: BucketFieldSelectionPopupProps) => {
  const [selectedType, setSelectedType] = useState<FieldKind | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const {registerPopover, unregisterPopover, getInset, formatInset} = usePopoverStack();
  const [popoverId, setPopoverId] = useState<string | null>(null);
  const [insetStyle, setInsetStyle] = useState<React.CSSProperties>({});
  const [currentInset, setCurrentInset] = useState<InsetValue | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const selectionPopoverWidth = 200;
  const selectionPopoverHeight = 400;

  const handleOpen = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsOpen(true);
        
      const triggerElement = e.currentTarget as HTMLElement;
      triggerRef.current = triggerElement;
      const rect = triggerElement.getBoundingClientRect();
      
      const popoverWidth = selectionPopoverWidth;
      const popoverHeight = selectionPopoverHeight;
      const gap = 4;
      
      const baseInset = {
        top: rect.bottom + gap,
        right: window.innerWidth - (rect.left + popoverWidth),
        bottom: window.innerHeight - (rect.bottom + gap + popoverHeight),
        left: rect.left
      };
      
      const {popoverId: newPopoverId, inset} = registerPopover(baseInset, popoverWidth, popoverHeight);
      setPopoverId(newPopoverId);
      setCurrentInset(inset);
      setInsetStyle({
        inset: formatInset(inset),
        position: "fixed" as const
      });
    },
    [registerPopover, formatInset]
  );

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setSelectedType(null);
    if (popoverId) {
      unregisterPopover(popoverId);
      setPopoverId(null);
    }
  }, [popoverId, unregisterPopover]);

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
        setCurrentInset(inset);
        setInsetStyle({
          inset: formatInset(inset),
          position: "fixed" as const
        });
      }
    }
  }, [popoverId, isOpen, getInset, formatInset]);

  const handleTypeSelect = (kind: FieldKind) => {
    setSelectedType(kind);
  };

  const handleSaveAndClose = async (values: FieldFormState) => {
    if (!selectedType) return;
    try {
      await onSaveAndClose(values, selectedType);
      handleClose();
    } catch (error) {
      console.error("Error saving field:", error);
    }
  };

  const outerPortalClassName = `${selectedType ? styles.hidden : ""}`;

  return (
    <Popover
      open={isOpen}
      onClose={handleClose}
      portalClassName={outerPortalClassName}
      contentProps={{
        className: styles.popoverContent,
        style: insetStyle,
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
        }
      }}
      containerProps={{
        dimensionX: "fill",
        className: styles.newFieldButtonContainer
      }}
      content={
        <BucketFieldConfigurationPopup
          isOpen={!!selectedType}
          selectedType={selectedType}
          onClose={handleClose}
          onSaveAndClose={handleSaveAndClose}
          popupType={popupType}
          forbiddenFieldNames={forbiddenFieldNames}
          parentInset={currentInset}
        >
          <FlexElement dimensionX={200} direction="vertical" className={styles.container}>
            {Object.values(FIELD_REGISTRY).map(field => (
              <ListItem
                key={field.kind}
                label={field.display.label}
                dimensionX="fill"
                dimensionY="hug"
                gap={10}
                prefix={{children: <Icon name={field.display.icon} />}}
                onClick={() => handleTypeSelect(field.kind)}
                className={styles.item}
              />
            ))}
          </FlexElement>
        </BucketFieldConfigurationPopup>
      }
    >
      <div className={styles.addNewFieldButtonChildren}>
        {children({onOpen: handleOpen, className: styles.newFieldButtonContainer})}
      </div>
    </Popover>
  );
};

export default memo(BucketFieldSelectionPopup);
