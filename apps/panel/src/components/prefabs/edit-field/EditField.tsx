import React, {useState, type FC, type ReactNode} from "react";
import BucketFieldConfigurationPopup from "../../molecules/bucket-field-popup/BucketFieldConfigurationPopup";
import {Icon} from "oziko-ui-kit";
import {Button} from "oziko-ui-kit";

interface EditFieldProps {
  field: any; // TODO: add type
  children: (props: {
    isOpen: boolean;
    onOpen: (e: React.MouseEvent) => void;
    onClose: () => void;
  }) => ReactNode;
}

const EditField: FC<EditFieldProps> = ({field, children}) => {
  const [isOpen, setIsOpen] = useState(false);
  const handleOpen = () => {
    setIsOpen(true);
  };
  const handleClose = () => {
    setIsOpen(false);
  };
  const handleSaveAndClose = () => {
    setIsOpen(false);
  };
  return (
    <>
      <BucketFieldConfigurationPopup
        isOpen={isOpen}
        selectedType={field.type}
        onClose={handleClose}
        onSaveAndClose={handleSaveAndClose}
        forbiddenFieldNames={[]}
        initialValues={field}
      >
        {children({
          isOpen: isOpen,
          onOpen: handleOpen,
          onClose: handleClose
        })}
      </BucketFieldConfigurationPopup>
    </>
  );
};

export default EditField;
