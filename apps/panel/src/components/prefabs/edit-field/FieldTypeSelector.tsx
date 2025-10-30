import React from "react";
import {Modal, Icon, type IconName, ListItem, FlexElement, Popover} from "oziko-ui-kit";
import {FIELD_TYPES} from "./types";
import styles from "./FieldTypeSelector.module.scss";
import { FIELD_REGISTRY } from "../../../domain/fields/registry";

interface FieldTypeSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectType: (type: string) => void;
  currentType?: string;
}

const FieldTypeSelector: React.FC<FieldTypeSelectorProps> = ({
  isOpen,
  onClose,
  onSelectType,
  currentType
}) => {
  return (

        <FlexElement dimensionX="fill" direction="vertical" className={styles.typeGrid}>
        {Object.values(FIELD_REGISTRY).map(field => (
              <ListItem
                key={field.kind}
                label={field.display.label}
                dimensionX="fill"
                dimensionY="hug"
                gap={10}
                prefix={{children: <Icon name={field.display.icon as IconName} />}}
                onClick={() => onSelectType(field.kind)}
                className={styles.item}
              />
            ))}
        </FlexElement>
  );
};

export default FieldTypeSelector;

