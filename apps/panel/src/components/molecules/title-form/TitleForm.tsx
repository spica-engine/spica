import {Button, FluidContainer, Icon, Text, FlexElement, Modal, Input} from "oziko-ui-kit";
import {type FC, memo, useState} from "react";
import styles from "./TitleForm.module.scss";

type TypeTitleFormProps = {
  title: string;
  initialValue: string;
  onClose?: () => void;
  onSubmit: (value: string) => void | Promise<void>;
  loading?: boolean;
  error?: string;
  closeAfterSubmit?: boolean;
};

const TitleForm: FC<TypeTitleFormProps> = ({
  initialValue,
  onClose,
  onSubmit,
  title,
  loading,
  error,
  closeAfterSubmit = true
}) => {
  const [value, setValue] = useState(initialValue);
  const handleSave = () => {
    onSubmit(value);
    if (closeAfterSubmit) onClose?.();
  };
  return (
    <Modal showCloseButton={false} onClose={onClose} className={styles.modal} isOpen>
      <FluidContainer
        className={styles.container}
        direction="vertical"
        gap={10}
        mode="fill"
        prefix={{
          children: (
            <div className={styles.header}>
              <Text className={styles.headerText}>{title}</Text>
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
                  placeholder="Name"
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
              <div className={styles.addButtonWrapper}>
                <Button
                  className={styles.addButton}
                  onClick={handleSave}
                  disabled={loading}
                  loading={loading}
                >
                  <Icon name="save" />
                  <Text className={styles.addButtonText}>Save</Text>
                </Button>
              </div>
              <Button
                className={styles.cancelButton}
                variant="text"
                onClick={() => onClose?.()}
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
  );
};

export default memo(TitleForm);
