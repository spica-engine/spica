import {Button, FlexElement, Icon, Popover, Text} from "oziko-ui-kit";
import {memo, type FC} from "react";
import styles from "./BucketNavigatorPopup.module.scss";
import {useDrawerController} from "../../../contexts/DrawerContext";
import TitleForm from "../title-form/TitleForm";
import type {BucketType} from "../../../services/bucketService";
import useApi from "../../../hooks/useApi";

type TypeBucketNavigatorPopup = {
  onAddToCategory?: () => void;
  onDelete?: () => void;
  bucket: BucketType;
};

type TitleFormWrapperProps = {
  onSubmit?: () => void;
  bucketId: string;
  initialValue: string;
};

const TitleFormWrapper = ({onSubmit, bucketId, initialValue}: TitleFormWrapperProps) => {
  const {request, loading, error} = useApi({
    endpoint: `/api/bucket/${bucketId}`,
    method: "patch"
  });

  const onSubmit_ = (newTitle: string) => {
    request({body: {title: newTitle}}).then(result => {
      if (!result) return;
      onSubmit?.();
    });
  };

  return (
    <TitleForm
      onSubmit={onSubmit_}
      initialValue={initialValue}
      loading={loading}
      error={error ?? ""}
    />
  );
};

const BucketNavigatorPopup: FC<TypeBucketNavigatorPopup> = ({
  onAddToCategory,
  onDelete,
  bucket
}) => {
  const {openDrawer, closeDrawer} = useDrawerController();

  return (
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
            onClick={() => {
              openDrawer(
                <TitleFormWrapper
                  bucketId={bucket._id}
                  initialValue={bucket.title}
                  onSubmit={closeDrawer}
                />
              );
            }}
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
            onClick={onDelete}
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
  );
};

export default memo(BucketNavigatorPopup);
