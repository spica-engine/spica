import {Button, FluidContainer, Input, Select} from "oziko-ui-kit";
import styles from "./CategorySelectCreate.module.scss";
import {useState} from "react";

type CategorySelectCreateProps = {
  categories: string[];
};

const MAX_LENGTH = 45;
const CategorySelectCreate = ({categories}: CategorySelectCreateProps) => {
  const [newCategory, setNewCategory] = useState("");

  return (
    <FluidContainer
      mode="fill"
      dimensionX={"fill"}
      direction="vertical"
      gap={20}
      className={styles.container}
      prefix={{
        children: (
          <>
            <label>New Category</label>
            <Input
              autoFocus
              className={styles.input}
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
            />
          </>
        )
      }}
      root={{
        children: (
          <Select
            options={categories}
            dimensionY="fill"
            dimensionX={120}
            placeholder="Choose A Category"
            className={styles.select}
          />
        )
      }}
      suffix={{
        children: (
          <Button className={`${styles.addButton}`}>
            <span className={styles.prefix}>Add</span>
            <span className={styles.dynamic}>
              &nbsp;"
              {newCategory.length
                ? newCategory.slice(0, MAX_LENGTH) +
                  "" +
                  (newCategory.length > MAX_LENGTH ? "..." : "")
                : " "}
              "&nbsp;
            </span>
            <span className={styles.suffix}>as new category</span>
          </Button>
        )
      }}
    />
  );
};

export default CategorySelectCreate;
