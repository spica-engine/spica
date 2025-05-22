import React, {memo} from "react";
import styles from "./BucketActionBar.module.scss";
import {Button, FlexElement, Icon, InputWithIcon} from "oziko-ui-kit";
const BucketActionBar = () => {
  return (
    <div className={styles.container}>
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
