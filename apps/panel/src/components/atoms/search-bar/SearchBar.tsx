import {Icon, InputWithIcon, type TypeInput} from "oziko-ui-kit";
import React from "react";
import styles from "./SearchBar.module.scss";
import {memo} from "react";
import Loader from "../loader/Loader";

type SearchBarProps = {
  inputProps?: TypeInput;
  loading?: boolean;
};

const SearchBar = ({inputProps, loading}: SearchBarProps) => {
  return (
    <div className={styles.container}>
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
      {loading && <Loader />}
    </div>
  );
};

export default memo(SearchBar);
