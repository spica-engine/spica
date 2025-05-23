import {Icon, InputWithIcon} from "oziko-ui-kit";
import React from "react";
import styles from "./SearchBar.module.scss";
import {memo} from "react";
const SearchBar = () => {
  return (
    <InputWithIcon
      gap={10}
      dimensionX={400}
      prefix={{
        children: <Icon name="magnify" className={styles.icon} />
      }}
      inputProps={{
        placeholder: "Search"
      }}
      className={styles.input}
    ></InputWithIcon>
  );
};

export default memo(SearchBar);
