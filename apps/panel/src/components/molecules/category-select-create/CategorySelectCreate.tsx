import {Button, FluidContainer, Input} from "oziko-ui-kit";
import styles from "./CategorySelectCreate.module.scss";
import {memo, useCallback, useEffect, useId, useMemo, useState} from "react";
import truncateText from "../../../utils/truncate-text";

type CategorySelectCreateProps = {
  bucketId: string;
  categories: string[];
  onSubmit?: () => void;
  changeCategory: (bucketId: string, category: string) => Promise<any>;
};

const CategorySelectCreate = ({
  bucketId,
  categories,
  onSubmit,
  changeCategory
}: CategorySelectCreateProps) => {
  const [textValue, setTextValue] = useState("");
  const [textError, setTextError] = useState<string | null>(null);
  const textInputId = useId();
  const extendedCategories = useMemo(
    () => categories.filter(i => i.toLowerCase().includes(textValue.toLowerCase())),
    [categories, textValue]
  );
  const handleSubmit = useCallback((value: string) => {
    changeCategory(bucketId, value).then(() => onSubmit?.());
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

  return (
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
              {extendedCategories.length ? (
                extendedCategories.map(i => (
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
      suffix={{
        children: (
          <Button onClick={handleTextSubmit} className={`${styles.addButton}`}>
            <span className={styles.prefix}>Add</span>
            <span className={styles.dynamic}>&nbsp;"{truncateText(textValue, 45)}"&nbsp;</span>
            <span className={styles.suffix}>as new category</span>
          </Button>
        )
      }}
    />
  );
};

export default memo(CategorySelectCreate);
