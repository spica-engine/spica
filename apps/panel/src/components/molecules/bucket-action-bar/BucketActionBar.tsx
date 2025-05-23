import React, {memo} from "react";
import styles from "./BucketActionBar.module.scss";
import {Button, FlexElement, Icon, InputWithIcon} from "oziko-ui-kit";
import SearchBar from "../../../components/atoms/search-bar/SearchBar";
const BucketActionBar = () => {
  return (
    <div className={styles.container}>
      <SearchBar />
      <FlexElement>
        <Button onClick={() => {}}>
          <Icon name="plus" />
          New Entry
        </Button>
        <Button color="default" onClick={() => {}}>
          <Icon name="refresh" />
          Refresh
        </Button>
        <Button color="default" onClick={() => {}}>
          <Icon name="eye" />
          Column
        </Button>
        <Button color="default" onClick={() => {}}>
          <Icon name="dotsVertical" />
          More
        </Button>
      </FlexElement>
    </div>
  );
};

export default memo(BucketActionBar);
