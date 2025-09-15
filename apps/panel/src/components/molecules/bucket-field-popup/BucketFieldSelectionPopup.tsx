import {cloneElement, memo, useRef, useState, type ReactNode, useMemo} from "react";
import {FlexElement, ListItem, Icon, Popover, type IconName} from "oziko-ui-kit";
import styles from "./BucketFieldPopup.module.scss";
import type {FormValues} from "../../../components/organisms/bucket-add-field/BucketAddFieldBusiness";
import {useBucketFieldPopups} from "./BucketFieldPopupsContext";
import BucketFieldConfigurationPopup from "./BucketFieldConfigurationPopup";
import type {Placement} from "oziko-ui-kit/dist/custom-hooks/useAdaptivePosition";
import type {PopupType} from "./BucketFieldPopupsContext";
import {FieldKind} from "../../../domain/fields";
import { FIELD_REGISTRY } from "../../../domain/fields/registry";

type BucketFieldSelectionPopupProps = {
  children: ReactNode;
  onSaveAndClose: (values: FormValues, kind: FieldKind) => void | Promise<any>;
  placement?: Placement;
  popupType?: PopupType;
};

const BucketFieldSelectionPopup = ({
  children,
  onSaveAndClose,
  placement,
  popupType = "add-field"
}: BucketFieldSelectionPopupProps) => {
  const [selectedType, setSelectedType] = useState<FieldKind | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const {bucketFieldPopups, setBucketFieldPopups} = useBucketFieldPopups();
  const fieldOptionsListContainerRef = useRef<HTMLDivElement>(null);

  const [bucketFieldPopupId, setBucketFieldPopupId] = useState<string>();

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(true);
  };

  const handleClose = () => {
    setBucketFieldPopups(bucketFieldPopups.filter(popup => popup.id !== bucketFieldPopupId));
    setIsOpen(false);
    setSelectedType(null);
  };

  const fieldOptions = useMemo(
    () =>
      Object.values(FIELD_REGISTRY).map(o => ({
        icon: o.display.icon as IconName,
        text: o.display.label,
        kind: o.kind
      })),
    []
  );

  const handleTypeSelect = (kind: FieldKind) => {
    setSelectedType(kind);
  };

  const handleConfigurationClose = (event?: MouseEvent) => {
    if (event?.target && fieldOptionsListContainerRef.current?.contains(event.target as Node)) {
      return;
    }
    setSelectedType(null);
  };

  const handleSaveAndClose = (values: FormValues) => {
    const maybePromise = onSaveAndClose(values, selectedType as FieldKind);

    const runHandlers = () => {
      setSelectedType(null);
      handleClose();
    };

    if (maybePromise instanceof Promise) {
      maybePromise.then(res => {
        if (res) runHandlers();
      });
    } else runHandlers();
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
          onClose={handleConfigurationClose}
          onSaveAndClose={handleSaveAndClose}
          onRegister={setBucketFieldPopupId}
          popupType={popupType}
        >
          <FlexElement
            ref={fieldOptionsListContainerRef}
            dimensionX={200}
            direction="vertical"
            className={styles.container}
          >
            {fieldOptions.map(({icon, text, kind}) => (
              <ListItem
                key={kind}
                label={text}
                dimensionX="fill"
                dimensionY="hug"
                gap={10}
                prefix={{children: <Icon name={icon} />}}
                onClick={() => handleTypeSelect(kind)}
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
