import {cloneElement, memo, useState, type ReactNode} from "react";
import {FlexElement, ListItem, Icon, Popover, type IconName} from "oziko-ui-kit";
import styles from "./BucketFieldPopup.module.scss";
import BucketFieldConfigurationPopup from "./BucketFieldConfigurationPopup";
import type {Placement} from "oziko-ui-kit/dist/custom-hooks/useAdaptivePosition";
import type {PopupType} from "./BucketFieldPopupsContext";
import {FieldKind} from "../../../domain/fields";
import {FIELD_REGISTRY} from "../../../domain/fields/registry";
import type {FieldFormState} from "../../../domain/fields/types";
import type {BucketType} from "src/services/bucketService";

type BucketFieldSelectionPopupProps = {
  children: ReactNode;
  onSaveAndClose: (values: FieldFormState, kind: FieldKind) => void | Promise<BucketType>;
  placement?: Placement;
  popupType?: PopupType;
  forbiddenFieldNames?: string[];
};

const BucketFieldSelectionPopup = ({
  children,
  onSaveAndClose,
  placement,
  popupType = "add-field",
  forbiddenFieldNames = []
}: BucketFieldSelectionPopupProps) => {
  const [selectedType, setSelectedType] = useState<FieldKind | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    setSelectedType(null);
  };

  const handleTypeSelect = (kind: FieldKind) => {
    setSelectedType(kind);
  };

  const handleSaveAndClose = async (values: FieldFormState) => {
    try {
      await onSaveAndClose(values, selectedType as FieldKind);
      handleClose();
    } catch (error) {
      console.error("Error saving field:", error);
    }
  };

  const outerPortalClassName = `${!selectedType ? "" : styles.hidden}`;

  return (
    <Popover
      placement={placement}
      open={isOpen}
      onClose={handleClose}
      portalClassName={outerPortalClassName}
      contentProps={{className: styles.popoverContent}}
      content={
        <BucketFieldConfigurationPopup
          isOpen={!!selectedType}
          selectedType={selectedType as FieldKind | null}
          onClose={handleClose}
          onSaveAndClose={handleSaveAndClose}
          popupType={popupType}
          forbiddenFieldNames={forbiddenFieldNames}
        >
          <FlexElement dimensionX={200} direction="vertical" className={styles.container}>
            {Object.values(FIELD_REGISTRY).map(field => (
              <ListItem
                key={field.kind}
                label={field.display.label}
                dimensionX="fill"
                dimensionY="hug"
                gap={10}
                prefix={{children: <Icon name={field.display.icon as IconName} />}}
                onClick={() => handleTypeSelect(field.kind)}
                className={styles.item}
              />
            ))}
          </FlexElement>
        </BucketFieldConfigurationPopup>
      }
    >
      <>
        {cloneElement(children as React.ReactElement<{onClick?: (e: React.MouseEvent) => void}>, {
          onClick: handleOpen
        })}
      </>
    </Popover>
  );
};

export default memo(BucketFieldSelectionPopup);
