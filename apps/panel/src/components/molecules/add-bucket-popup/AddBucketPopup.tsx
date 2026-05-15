import React from "react";
import {Button, Icon} from "oziko-ui-kit";
import styles from "./AddBucketPopup.module.scss";
import EditBucket from "../../prefabs/edit-bucket/EditBucket";

const AddBucketPopup = () => {
  // TODO: This component should be refactored or EditBucket should be refactored because adding a new bucket is not 
  // editing a bucket. It should be a separate component. They may use common ui
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
          New Bucket
        </Button>
      )}
    </EditBucket>
  );
};

export default AddBucketPopup;
