import {Button, FlexElement, Icon, Input, Modal, Text} from "oziko-ui-kit";
import styles from "./Confirmation.module.scss";
import {useState, useMemo, memo, type ReactNode} from "react";

type ConfirmationProps = {
  title: string;
  description?: string | ReactNode;
  confirmLabel?: string | ReactNode;
  cancelLabel?: string | ReactNode;
  showInput?: boolean;
  inputPlaceholder?: string;
  inputDefaultValue?: string;
  confirmCondition?: (input: string) => boolean;
  onConfirm: (inputValue?: string) => void;
  onCancel: () => void;
  loading?: boolean;
  showCloseButton?: boolean;
};

function Confirmation({
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  showInput = true,
  inputPlaceholder,
  inputDefaultValue,
  confirmCondition,
  onConfirm,
  onCancel,
  loading,
  showCloseButton
}: ConfirmationProps) {
  const [inputValue, setInputValue] = useState(inputDefaultValue ?? "");

  const confirmConditionResult = useMemo(() => {
    if (!confirmCondition) return true;
    return confirmCondition(inputValue);
  }, [inputValue, confirmCondition]);

  const isConfirmEnabled = !loading && confirmConditionResult;

  return (
    <Modal
      showCloseButton={showCloseButton ?? false}
      onClose={onCancel}
      className={styles.confirmModal}
      isOpen
    >
      <Modal.Header
        prefix={{
          children: <Text className={styles.title}>{title}</Text>
        }}
        className={styles.header}
      />
      <Modal.Body className={styles.body}>
        {description && <span>{description}</span>}
        {showInput && (
          <FlexElement gap={5} className={styles.inputContainer}>
            <Icon name="formatQuoteClose" size="md" />
            <Input
              autoFocus
              placeholder={inputPlaceholder}
              className={styles.input}
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              type="text"
            />
          </FlexElement>
        )}
      </Modal.Body>
      <Modal.Footer
        dimensionX="fill"
        alignment="rightCenter"
        className={styles.footer}
        prefix={{
          children: (
            <Button
              color="danger"
              onClick={() => onConfirm(inputValue)}
              className={styles.confirmButton}
              disabled={!isConfirmEnabled}
            >
              {confirmLabel}
            </Button>
          )
        }}
        suffix={{
          children: (
            <Button
              color="default"
              variant="text"
              onClick={() => onCancel()}
              className={styles.cancelButton}
            >
              {cancelLabel}
            </Button>
          )
        }}
      />
    </Modal>
  );
}

export default memo(Confirmation);
