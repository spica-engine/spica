import { Icon, InputWithIcon, Spinner, type TypeInput} from "oziko-ui-kit";
import styles from "./SearchBar.module.scss";
import {memo} from "react";

type SearchBarProps = {
  inputProps?: TypeInput;
  loading?: boolean;
  className?: string;
};

const SearchBar = ({inputProps, loading, className}: SearchBarProps) => {
  return (
    <div className={`${styles.container} ${className ?? ""}`}>
      <InputWithIcon
        gap={10}
        dimensionX={220}
        prefix={{
          children: loading ? <Spinner size="small" spinnerClassName={styles.spinner} /> : <Icon name="magnify" className={styles.icon} />
        }}
        inputProps={{
          placeholder: "Search",
          ...inputProps
        }}
        className={styles.input}
      />
    </div>
  );
};

export default memo(SearchBar);
