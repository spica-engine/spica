import {Button, FlexElement, Icon, Popover, Text} from "oziko-ui-kit";
import {memo, type FC} from "react";
import styles from "./BucketNavigatorPopup.module.scss";
import {useDrawerController} from "../../../contexts/DrawerContext";
import TitleForm from "../title-form/TitleForm";
import useApi from "../../../hooks/useApi";
import type {BucketType} from "src/services/bucketService";

type TypeBucketNavigatorPopup = {
  onAddToCategory?: () => void;
  onDelete?: () => void;
  bucket: BucketType;
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
              openDrawer(<TitleForm bucketId={bucket._id} initalValue={bucket.title} onSave={closeDrawer}/>);
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
