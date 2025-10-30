import React, {useEffect, useState, useCallback, type ReactNode} from "react";
import {Modal, Button, Icon, type IconName} from "oziko-ui-kit";
import {type FieldConfig, FIELD_TYPES} from "./types";
import {buildEditor} from "./EditorBuilder";
import FieldTypeSelector from "./FieldTypeSelector";
import styles from "./EditField.module.scss";

interface EditFieldProps {
  field: FieldConfig;
  onSave: (field: FieldConfig) => void;
  children: (props: { 
    isOpen: boolean;
    onOpen: (e: React.MouseEvent) => void;
    onClose: () => void;
}) => ReactNode;
}

const EditField: React.FC<EditFieldProps> = ({field, onSave, children}) => {
  const [isTypeSelectorOpen, setIsTypeSelectorOpen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [currentField, setCurrentField] = useState<FieldConfig>(field);
  const [Editor, setEditor] = useState(() => buildEditor(field.type));

  const handleOpen = useCallback((e: React.MouseEvent) => {
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
      {children({
        isOpen: isTypeSelectorOpen || isEditorOpen,
        onOpen: handleOpen,
        onClose: handleCloseEditor
      })}

      <FieldTypeSelector
        isOpen={isTypeSelectorOpen}
        onClose={handleCloseTypeSelector}
        onSelectType={handleSelectType}
        currentType={currentField.type}
      />

      <Modal isOpen={isEditorOpen} onClose={handleCloseEditor}>
        <div className={styles.editFieldModal}>
          <div className={styles.content}>
            <div className={styles.typeIndicator}>
              <Icon
                name={FIELD_TYPES.find(t => t.value === currentField.type)?.icon as IconName || "cube"}
              />
              <span>
                {FIELD_TYPES.find(t => t.value === currentField.type)?.label ||
                  currentField.type}
              </span>
            </div>

            <div className={styles.editorContainer}>
              <Editor value={currentField} onChange={setCurrentField} />
            </div>
          </div>

          <div className={styles.footer}>
            <Button color="default" onClick={handleSave}>
              <Icon name="save" />
              Save and close
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default EditField;

