// @owner Kanan Gasimov


import React, {useState, useEffect} from "react";
import {Modal, Icon, type IconName, ListItem, FlexElement, Popover, Button} from "oziko-ui-kit";
import {type FieldConfig, FIELD_TYPES} from "./types";
import styles from "./FieldTypeSelector.module.scss";
import editFieldStyles from "./EditField.module.scss";
import {FIELD_REGISTRY} from "../../../domain/fields/registry";
import {buildEditor} from "./EditorBuilder";

interface FieldTypeSelectorProps {
  onClose: () => void;
  onSelectType: (type: string) => void;
  onSaveField: (field: FieldConfig) => void;
}

const FieldTypeSelector: React.FC<FieldTypeSelectorProps> = ({
  onClose,
  onSelectType,
  onSaveField
}) => {
  const [openPopoverId, setOpenPopoverId] = useState<string | null>(null);
  const [newField, setNewField] = useState<FieldConfig | null>(null);
  const [typeSelected, setTypeSelected] = useState<string | null>(null);
  const [Editor, setEditor] = useState(() => buildEditor(newField?.type || undefined));

  const [isTypeSelected, setIsTypeSelected] = useState(false);

  const handleListItemClick = (e: React.MouseEvent, fieldKind: string) => {
    e.stopPropagation();
    setIsTypeSelected(true);
    setTypeSelected(fieldKind);
    setNewField(createNewEmptyField(fieldKind));
    setEditor(() => buildEditor(fieldKind || undefined));
  };

  const handleSave = () => {
    setOpenPopoverId(null);
    onClose();
  };

  const handlePopoverClose = () => {
    setOpenPopoverId(null);
    setIsTypeSelected(false);
  };
  const createNewEmptyField = (fieldKind: string) => {
    return {
      type: fieldKind,
      name: "",
      title: "",
      description: ""
    };
  };

  return (
    <Popover
      open={isTypeSelected}
      onClose={handlePopoverClose}
      contentProps={{className: styles.popoverContent}}
      content={
        <FlexElement dimensionX={200} direction="vertical" className={styles.typeGrid}>
          <div>
            <Editor value={newField!} onChange={setNewField} />
          </div>
        </FlexElement>
      }

    >
        <FlexElement dimensionX={200} direction="vertical" className={styles.types}>
            {Object.values(FIELD_REGISTRY).map(field => (
              <ListItem
                key={field.kind}
                label={field.display.label}
                dimensionX="fill"
                dimensionY="hug"
                gap={10}
                prefix={{children: <Icon name={field.display.icon as IconName} />}}
                onClick={e => handleListItemClick(e, field.kind)}
                className={styles.item}
              />
            ))}
          </FlexElement>
    </Popover>
  );
};

export default FieldTypeSelector;
