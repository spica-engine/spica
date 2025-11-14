// @owner Kanan Gasimov


import React, {useEffect, useState, useCallback} from "react";
import {Modal, Button, Icon, type IconName, Popover} from "oziko-ui-kit";
import {type FieldConfig, FIELD_TYPES} from "./types";
import {buildEditor} from "./EditorBuilder";
import FieldTypeSelector from "./FieldTypeSelector";
import styles from "./EditField.module.scss";

interface EditFieldProps {
  field: FieldConfig;
  onSave: (field: FieldConfig) => void;
}

const EditField: React.FC<EditFieldProps> = ({field, onSave}) => {
  const [isTypeSelectorOpen, setIsTypeSelectorOpen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [currentField, setCurrentField] = useState<FieldConfig>(field);
  const [Editor, setEditor] = useState(() => buildEditor(field.type));

  const handleOpen = useCallback((e: React.MouseEvent) => {
    console.log("handleOpen");
    e.stopPropagation();
    setCurrentField(field);
    setIsTypeSelectorOpen(true);
  }, [field]);

  const handleCloseTypeSelector = useCallback(() => {
    setIsTypeSelectorOpen(false);
  }, []);

  const handleCloseEditor = useCallback(() => {
    setIsEditorOpen(false);
  }, []);

  const handleSelectType = useCallback((type: string) => {
    setCurrentField(prev => ({...prev, type}));
    setIsTypeSelectorOpen(false);
    setIsEditorOpen(true);
  }, []);

  const handleSave = useCallback(() => {
    onSave(currentField);
    setIsEditorOpen(false);
  }, [currentField, onSave]);

  useEffect(() => {
    setEditor(() => buildEditor(currentField.type));
  }, [currentField.type]);

  return (
    <>
      <Popover
        open={isTypeSelectorOpen}
        onClose={handleCloseTypeSelector}
        content={
          <FieldTypeSelector
            onClose={handleCloseTypeSelector}
            onSelectType={handleSelectType}
            onSaveField={handleSave}
          />
        }
      >
        <Button variant="icon" onClick={handleOpen} className={styles.editButton}>
          <Icon name="pencil" />
        </Button>
      </Popover>

    </>
  );
};

export default EditField;

