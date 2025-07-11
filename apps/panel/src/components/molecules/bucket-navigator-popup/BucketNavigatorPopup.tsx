import {Button, FlexElement, Icon, Popover, Text} from "oziko-ui-kit";
import React, {memo, useState, type FC} from "react";
import styles from "./BucketNavigatorPopup.module.scss";
import type {BucketType} from "../../../services/bucketService";
import {useBucket} from "../../../contexts/BucketContext";
import Confirmation from "../confirmation/Confirmation";

type TypeBucketNavigatorPopup = {
  onAddToCategory?: () => void;
  onEdit?: () => void;
  bucket: BucketType;
};
const BucketNavigatorPopup: FC<TypeBucketNavigatorPopup> = ({onAddToCategory, onEdit, bucket}) => {
  const {deleteBucket, deleteBucketLoading, deleteBucketError} = useBucket();
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);

  const handleDeleteBucket = () => {
    deleteBucket(bucket._id).then(result => {
      if (!result) return;
      setIsConfirmationOpen(false);
    });
  };

  return (
    <>
      <Popover
        contentProps={{
          className: styles.popoverContainer
        }}
        content={
          <FlexElement dimensionX={160} direction="vertical" className={styles.popoverContent}>
            <Button
              containerProps={{
                alignment: "leftCenter",
                dimensionX: "fill"
              }}
              color="default"
              onClick={onAddToCategory}
              className={styles.buttons}
            >
              <Icon name="plus" />
              <Text>Add to category</Text>
            </Button>
            <Button
              containerProps={{
                alignment: "leftCenter",
                dimensionX: "fill"
              }}
              color="default"
              onClick={onEdit}
              className={styles.buttons}
            >
              <Icon name="pencil" />
              <Text>Edit</Text>
            </Button>
            <Button
              containerProps={{
                alignment: "leftCenter",
                dimensionX: "fill"
              }}
              color="default"
              onClick={() => {
                setIsConfirmationOpen(true);
              }}
              className={styles.buttons}
            >
              <Icon name="delete" className={styles.deleteIcon} />
              <Text variant="danger">Delete</Text>
            </Button>
          </FlexElement>
        }
      >
        <Button color="transparent" variant="icon">
          <Icon name="dotsVertical" />
        </Button>
      </Popover>
      {isConfirmationOpen && (
        <Confirmation
          title={`Delete Bucket ${bucket.title}`}
          description={`Please type ${bucket.title} to confirm deletion. This action can not be undone.`}
          inputPlaceholder={`Type ${bucket.title} to confirm`}
          confirmText="Delete"
          cancelText="Cancel"
          showInput
          confirmCondition={val => val === bucket.title}
          onConfirm={handleDeleteBucket}
          onCancel={() => setIsConfirmationOpen(false)}
          loading={deleteBucketLoading}
        />
      )}
    </>
  );
};

export default memo(BucketNavigatorPopup);
