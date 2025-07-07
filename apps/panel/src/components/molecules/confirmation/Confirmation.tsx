import {Button, Modal} from "oziko-ui-kit";
import styles from "./Confirmation.module.scss";
import {useState, useId, useMemo} from "react";

type ConfirmationProps = {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  inputOptions?: {
    placeHolder?: string;
    defaultValue?: string;
    label?: string;
    enabled: boolean;
  };
  confirmCondition?: (input: string) => boolean; // disables confirm button if false
  onConfirm: (inputValue?: string) => void;
  onCancel: () => void;
  loading?: boolean;
};

function Confirmation({
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  inputOptions,
  confirmCondition,
  onConfirm,
  onCancel,
  loading
}: ConfirmationProps) {
  const [inputValue, setInputValue] = useState(inputOptions?.defaultValue ?? "");
  const inputId = useId();

  const confirmConditionResult = useMemo(() => {
    if (!confirmCondition) return true;
    return confirmCondition(inputValue);
  }, [inputValue, confirmCondition]);

  const isConfirmEnabled = !loading && confirmConditionResult;

  return (
    <Modal showCloseButton onClose={onCancel} className={styles.confirmModal} isOpen>
      <Modal.Header
        prefix={{
          children: (
            <h2 className={styles.title} id="confirmation-dialog-title">
              {title}
            </h2>
          )
        }}
        className={styles.header}
      />
      <Modal.Body className={styles.body} aria-labelledby="confirmation-dialog-title">
        {inputOptions?.enabled && (
          <>
            <label htmlFor={inputId}>
              {inputOptions.label}
            </label>
            <input
              id={inputId}
              autoFocus
              placeholder={inputOptions.placeHolder}
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              type="text"
              aria-describedby={description ? "confirmation-description" : undefined}
            />
          </>
        )}
        <span id="confirmation-description">{description}</span>
      </Modal.Body>
      <Modal.Footer
        dimensionX="fill"
        alignment="rightCenter"
        className={styles.footer}
        prefix={{
          children: (
            <Button color="default" onClick={() => onCancel()} className={styles.cancelButton}>
              {cancelText}
            </Button>
          )
        }}
        suffix={{
          children: (
            <Button
              color="default"
              onClick={() => onConfirm(inputValue)}
              className={styles.confirmButton}
              disabled={!isConfirmEnabled}
            >
              {confirmText}
            </Button>
          )
        }}
      ></Modal.Footer>
    </Modal>
  );
}

export default Confirmation;
