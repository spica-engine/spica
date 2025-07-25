import {Button, FluidContainer, Input, Modal, Text} from "oziko-ui-kit";
import styles from "./CategorySelectCreate.module.scss";
import {memo, useCallback, useEffect, useId, useMemo, useState} from "react";
import truncateText from "../../../utils/truncate-text";
import type {BucketType} from "src/services/bucketService";

type CategorySelectCreateProps = {
  bucket: BucketType;
  categories: string[];
  onCancel?: () => void;
  changeCategory: (bucketId: string, category: string) => Promise<any>;
};

const CategorySelectCreate = ({
  bucket,
  categories,
  onCancel,
  changeCategory
}: CategorySelectCreateProps) => {
  const [textValue, setTextValue] = useState("");
  const [textError, setTextError] = useState<string | null>(null);
  const textInputId = useId();

  const filteredCategories = useMemo(
    () => categories.filter(i => i.toLowerCase().includes(textValue.toLowerCase())),
    [categories, textValue]
  );

  const handleSubmit = useCallback((value: string) => {
    changeCategory(bucket._id, value).then(() => onCancel?.());
  }, []);

  const handleTextSubmit = useCallback(() => {
    const valid = handleValidation();
    if (!valid) return;
    handleSubmit(textValue);
  }, [textValue]);

  const handleValidation = useCallback(() => {
    if (categories.some(i => i === textValue)) {
      setTextError("Category already exists");
      return false;
    } else if (textValue === "") {
      setTextError("Please type the category name");
      return false;
    }
    setTextError(null);
    return true;
  }, [categories, textValue]);

  useEffect(() => {
    if (!textError) return;
    handleValidation();
  }, [textValue]);

  const truncatedCategoryName = truncateText(textValue, 32)

  return (
    <Modal showCloseButton={false} onClose={onCancel} className={styles.modal} isOpen>
      <Modal.Header
        className={styles.header}
        prefix={{
          children: (
            <Text className={styles.title}>
              Move {bucket.title} to Category{" "}
              <span className={styles.dynamic}>&nbsp;"{truncatedCategoryName}"&nbsp;</span>
            </Text>
          )
        }}
      />
      <Modal.Body>
        <FluidContainer
          mode="fill"
          dimensionX={"fill"}
          direction="vertical"
          gap={20}
          className={styles.container}
          prefix={{
            children: (
              <div className={styles.textFieldContainer}>
                <div className={styles.textField}>
                  <label htmlFor={textInputId} className={styles.label}>
                    Create a New Category
                  </label>
                  <Input
                    id={textInputId}
                    autoFocus
                    className={styles.input}
                    value={textValue}
                    onChange={e => setTextValue(e.target.value)}
                  />
                </div>
                {textError && <span className={styles.errorText}>{textError}</span>}
              </div>
            )
          }}
          root={{
            children: (
              <div className={styles.selectField}>
                <p className={styles.label}>Or choose an existing one</p>
                <div>
                  {filteredCategories.length ? (
                    filteredCategories.map(i => (
                      <Button onClick={() => handleSubmit(i)} key={i}>
                        {i}
                      </Button>
                    ))
                  ) : (
                    <span className={styles.noCategoryFound}>No category found</span>
                  )}
                </div>
              </div>
            )
          }}
        />
      </Modal.Body>
      <Modal.Footer
        dimensionX="fill"
        alignment="rightCenter"
        className={styles.footer}
        prefix={{
          children: (
            <Button onClick={handleTextSubmit} className={styles.addButton}>
              <span className={styles.prefix}>Add</span>
              <span className={styles.dynamic}>&nbsp;"{truncatedCategoryName}"&nbsp;</span>
              <span className={styles.suffix}>as new category</span>
            </Button>
          )
        }}
        suffix={{
          children: (
            <Button
              color="default"
              variant="text"
              onClick={() => onCancel?.()}
              className={styles.cancelButton}
            >
              Cancel
            </Button>
          )
        }}
      />
    </Modal>
  );
};

export default memo(CategorySelectCreate);
