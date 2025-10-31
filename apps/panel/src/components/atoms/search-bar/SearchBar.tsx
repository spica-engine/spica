import {Button, Icon, InputWithIcon, Spinner, type TypeInput} from "oziko-ui-kit";
import React from "react";
import styles from "./SearchBar.module.scss";
import {memo} from "react";

type SearchBarProps = {
  inputProps?: TypeInput;
  loading?: boolean;
  onClear?: () => void;
};

const SearchBar = ({inputProps, loading, onClear}: SearchBarProps) => {
  return (
    <div className={styles.container}>
      <InputWithIcon
        gap={10}
        dimensionX={400}
        prefix={{
          children: loading ? (
            <Spinner size="small" className={styles.icon} />
          ) : (
            <Icon name="magnify" className={styles.icon} />
          )
        }}
        inputProps={{
          placeholder: "Search",
          ...inputProps
        }}
        suffix={{
          children: onClear && inputProps?.value && (
            <Button variant="icon" onClick={onClear}>
              <Icon name="close" className={styles.icon} />
            </Button>
          )
        }}
        className={styles.input}
      />
    </div>
  );
};

export default memo(SearchBar);
