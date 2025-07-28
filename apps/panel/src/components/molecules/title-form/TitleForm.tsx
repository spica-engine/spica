import {Button, FluidContainer, Icon, Text, FlexElement, Modal, Input} from "oziko-ui-kit";
import {type FC, memo, useState} from "react";
import styles from "./TitleForm.module.scss";
import type {BucketType} from "src/services/bucketService";

type TypeTitleFormProps = {
  bucket: BucketType;
  initialValue: string;
  onClose?: () => void;
  onSubmit: (value: string) => void | Promise<void>;
};

const TitleForm: FC<TypeTitleFormProps> = ({bucket, initialValue, onClose, onSubmit}) => {
  const [value, setValue] = useState(initialValue);
  const handleSave = async () => {
    try {
      await onSubmit(value);
      onClose?.();
    } catch (err) {
      console.error(err);
    }
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
              <Text className={styles.headerText}>EDIT NAME</Text>
            </div>
          )
        }}
        root={{
          className: styles.inputContainerContainer,
          children: (
            <FlexElement gap={5} className={styles.inputContainer}>
              <Icon name="formatQuoteClose" size="md" />
              <Input
                className={styles.input}
                onChange={e => setValue(e.target.value)}
                placeholder="Name"
                value={value}
              />
            </FlexElement>
          )
        }}
        suffix={{
          dimensionX: "fill",
          alignment: "rightCenter",
          children: (
            <FlexElement gap={10} className={styles.buttonsContainer}>
              <div className={styles.addButtonWrapper}>
                <Button className={styles.addButton} onClick={handleSave}>
                  <Icon name="save" />
                  <Text className={styles.addButtonText}>Save</Text>
                </Button>
              </div>
              <Button className={styles.cancelButton} variant="text" onClick={() => onClose?.()}>
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
