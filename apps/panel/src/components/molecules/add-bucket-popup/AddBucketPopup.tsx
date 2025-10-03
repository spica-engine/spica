import React from "react";
import {Button, Icon, Text} from "oziko-ui-kit";
import styles from "./AddBucketPopup.module.scss";
import EditBucket from "../../prefabs/edit-bucket/EditBucket";

const AddBucketPopup = ({text}: {text?: string}) => {
  return (
    <EditBucket mode="create" initialValue="New Bucket">
      {({onOpen}) => (
        <Button
          onClick={onOpen}
          className={styles.addNewButton}
          color="transparent"
          variant="text"
        >
          <Icon name="plus" size="xs" />
          <Text className={styles.noLineHeight} size="medium">
            {text}
          </Text>
        </Button>
      )}
    </EditBucket>
  );
};

export default AddBucketPopup;
