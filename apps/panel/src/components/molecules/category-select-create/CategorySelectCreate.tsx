import {
  Button,
  FlexElement,
  FluidContainer,
  Icon,
  Input,
  Modal,
  Text,
  useOnClickOutside
} from "oziko-ui-kit";
import styles from "./CategorySelectCreate.module.scss";
import {memo, useCallback, useMemo, useRef, useState} from "react";
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
  const [focused, setFocused] = useState(false);

  const filteredCategories = useMemo(
    () => categories.filter(i => i.toLowerCase().includes(textValue.toLowerCase())),
    [categories, textValue]
  );

  const handleSubmit = useCallback((value: string) => {
    changeCategory(bucket._id, value).then(() => onCancel?.());
  }, []);

  const truncatedCategoryName = truncateText(textValue, 32);
  const calculatedCategoryName = truncatedCategoryName.length
    ? truncatedCategoryName
    : "Category Name";

  const containerRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useOnClickOutside({
    refs: [dropdownRef, containerRef],
    onClickOutside: () => {
      setFocused(false);
    }
  });

  return (
    <Modal
      showCloseButton={false}
      onClose={onCancel}
      className={styles.modal}
      isOpen
      onClick={e => e.stopPropagation()}
    >
      <Modal.Header
        onClick={e => e.stopPropagation()}
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
      <Modal.Body className={styles.modalBody}>
        <FluidContainer
          mode="fill"
          dimensionX={"fill"}
          direction="vertical"
          gap={20}
          prefix={{
            className: styles.inputSection,
            children: (
              <FlexElement gap={filteredCategories.length > 0 ? 10 : 0} direction="vertical" dimensionX="fill">
                <FlexElement ref={containerRef} gap={10} className={styles.inputContainer}>
                  <Icon name="formatQuoteClose" size="md" />
                  <Input
                    className={styles.input}
                    onChange={e => setTextValue(e.target.value)}
                    placeholder="Find a category"
                    value={textValue}
                    onFocus={() => setFocused(true)}
                  />
                </FlexElement>
                {focused && (
                  <FlexElement
                    ref={dropdownRef}
                    className={styles.optionsContainer}
                    direction="vertical"
                    alignment="leftTop"
                    gap={0}
                  >
                    {filteredCategories.map(option => {
                      return (
                        <Text
                          onClick={() => handleSubmit(option)}
                          className={styles.option}
                          key={option}
                        >
                          {option}
                        </Text>
                      );
                    })}
                  </FlexElement>
                )}
              </FlexElement>
            )
          }}
        />
      </Modal.Body>
      <Modal.Footer
        dimensionX="fill"
        alignment="rightCenter"
        className={styles.modalFooter}
        prefix={{
          children: (
            <Button
              color="primary"
              onClick={() => handleSubmit(textValue)}
              className={styles.addButton}
            >
              <Icon name="plus" size="sm" />
              <span className={styles.prefix}>Add</span>
              <span className={styles.dynamic}>&nbsp;"{calculatedCategoryName}"&nbsp;</span>
              <span className={styles.suffix}>as new category</span>
            </Button>
          )
        }}
        suffix={{
          children: (
            <Button variant="text" onClick={() => onCancel?.()} className={styles.cancelButton}>
              <Icon name="close" size="sm" />
              Cancel
            </Button>
          )
        }}
      />
    </Modal>
  );
};

export default memo(CategorySelectCreate);
