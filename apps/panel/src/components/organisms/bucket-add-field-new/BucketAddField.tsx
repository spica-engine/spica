// @owner Kanan Gasimov
import {Button, Icon, Popover} from "oziko-ui-kit";
import React, {useCallback, useState, type FC, type ReactNode} from "react";
import { FieldTypeSelector, type FieldConfig } from "../edit-field";
import { buildEditor } from "../edit-field/EditorBuilder";

interface BucketAddFieldProps {
    onSelectType: (type: string) => void;
    onSaveField: (field: FieldConfig) => void;
    bucketId: string;
    children: (props: {
        isOpen: boolean;
        onOpen: (e: React.MouseEvent) => void;
        onClose: () => void;
    }) => ReactNode;
}

const BucketAddField: FC<BucketAddFieldProps> = ({ onSelectType, onSaveField, bucketId, children }) => {
  const [isTypeSelectorOpen, setIsTypeSelectorOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string | undefined>(undefined);
  const [Editor, setEditor] = useState(() => buildEditor(undefined));
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [newField, setNewField] = useState<FieldConfig | null>(null);

  const handleOpen = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsTypeSelectorOpen(true);
  }, []);

  const handleCloseTypeSelector = useCallback(() => {
    setIsTypeSelectorOpen(false);
  }, []);

  const handleSelectType = useCallback((type: string) => {
    setIsTypeSelectorOpen(false);
    setIsEditorOpen(true);

    setNewField({
        type: type,
        name: "",
    });
  }, []);

  return (

   <Popover
      open={isTypeSelectorOpen}
      onClose={handleCloseTypeSelector}
      content={
        <FieldTypeSelector
          onClose={handleCloseTypeSelector}
          onSelectType={handleSelectType}
          onSaveField={() => {}}
        />
      }
    >
        {children({
            isOpen: isTypeSelectorOpen,
            onOpen: handleOpen,
            onClose: handleCloseTypeSelector,
        })}
    </Popover>
 
  );
};

export default BucketAddField;
