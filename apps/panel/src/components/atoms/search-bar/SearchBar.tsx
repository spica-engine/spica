import {Icon, InputWithIcon, type TypeInput} from "oziko-ui-kit";
import React from "react";
import styles from "./SearchBar.module.scss";
import {memo} from "react";

type SearchBarProps = {
  inputProps?: TypeInput
};

const SearchBar = ({inputProps}: SearchBarProps) => {
  return (
    <InputWithIcon
      gap={10}
      dimensionX={400}
      prefix={{
        children: <Icon name="magnify" className={styles.icon} />
      }}
      inputProps={{
        placeholder: "Search",
        ...inputProps
      }}
      className={styles.input}
    />
  );
};

export default memo(SearchBar);
