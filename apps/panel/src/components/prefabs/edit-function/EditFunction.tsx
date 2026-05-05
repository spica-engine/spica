import React, {useState, type FC, type ReactNode} from "react";
import {Button, FluidContainer, Icon, Text, FlexElement, Modal, Input} from "oziko-ui-kit";
import type {SpicaFunction} from "../../../store/api/functionApi";
import styles from "./EditFunction.module.scss";
import {useRenameFunctionMutation} from "../../../store/api";

type EditFunctionProps = {
  fn: SpicaFunction;
  children: (props: {
    isOpen: boolean;
    onOpen: (e: React.MouseEvent) => void;
    onClose: () => void;
  }) => ReactNode;
};

const EditFunction: FC<EditFunctionProps> = ({fn, children}) => {
  const [renameFunction] = useRenameFunctionMutation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [value, setValue] = useState(fn.name);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    try {
      setLoading(true);
      setError("");

      if (!value.trim()) {
        setError("This field cannot be left empty.");
        return;
      }

      if (value.length < 4) {
        setError("This field must be at least 4 characters long");
        return;
      }

      if (value.length > 100) {
        setError("This field cannot exceed 100 characters");
        return;
      }

      await renameFunction({newName: value, fn}).unwrap();
      setIsModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setValue(fn.name);
    setError("");
  };

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setValue(fn.name);
    setIsModalOpen(true);
  };

  return (
    <>
      {children({isOpen: isModalOpen, onOpen: handleOpen, onClose: handleClose})}
      {isModalOpen && (
        <Modal showCloseButton={false} onClose={handleClose} className={styles.modal} isOpen>
          <FluidContainer
            className={`${styles.container} ${error ? styles.containerWithError : ""}`}
            direction="vertical"
            gap={10}
            mode="fill"
            prefix={{
              children: (
                <div className={styles.header}>
                  <Text className={styles.headerText}>EDIT FUNCTION NAME</Text>
                </div>
              )
            }}
            root={{
              children: (
                <div>
                  <FlexElement gap={5} className={styles.inputContainer}>
                    <Icon name="formatQuoteClose" size="md" />
                    <Input
                      className={styles.input}
                      onChange={e => setValue(e.target.value)}
                      placeholder="Function name"
                      value={value}
                    />
                  </FlexElement>
                  {error && (
                    <Text variant="danger" className={styles.errorText}>
                      {error}
                    </Text>
                  )}
                </div>
              )
            }}
            suffix={{
              dimensionX: "fill",
              alignment: "rightCenter",
              children: (
                <FlexElement gap={10} className={styles.buttonsContainer}>
                  <div className={styles.saveButtonWrapper}>
                    <Button
                      className={styles.saveButton}
                      onClick={handleSave}
                      disabled={loading}
                      loading={loading}
                    >
                      <Icon name="save" />
                      <Text className={styles.saveButtonText}>Save</Text>
                    </Button>
                  </div>
                  <Button
                    className={styles.cancelButton}
                    variant="text"
                    onClick={handleClose}
                    disabled={loading}
                  >
                    <Icon name="close" />
                    <Text>Cancel</Text>
                  </Button>
                </FlexElement>
              )
            }}
          />
        </Modal>
      )}
    </>
  );
};

export default EditFunction;
