import React, {memo} from "react";
import styles from "./BucketActionBar.module.scss";
import {Button, FlexElement, Icon} from "oziko-ui-kit";
import SearchBar from "../../../components/atoms/search-bar/SearchBar";
import BucketMorePopup from "../bucket-more-popup/BucketMorePopup";
import type {BucketType} from "src/services/bucketService";

type BucketActionBarProps = {
  bucket: BucketType;
};

const BucketActionBar = ({bucket}: BucketActionBarProps) => {
  return (
    <div className={styles.container}>
      <SearchBar />
      <FlexElement className={styles.actionBar}>
        <Button onClick={() => {}}>
          <Icon name="plus" />
          New Entry
        </Button>
        <Button variant="text" onClick={() => {}}>
          <Icon name="refresh" />
          Refresh
        </Button>
        <Button variant="text" onClick={() => {}}>
          <Icon name="eye" />
          Column
        </Button>
        <BucketMorePopup bucket={bucket} />
      </FlexElement>
    </div>
  );
};

export default memo(BucketActionBar);
