import {Button, FlexElement, Icon, Popover, Text} from "oziko-ui-kit";
import {memo, type FC} from "react";
import styles from "./BucketNavigatorPopup.module.scss";
import {useDrawerController} from "../../../contexts/DrawerContext";
import type {BucketType} from "../../../services/bucketService";
import CategorySelectCreate from "../category-select-create/CategorySelectCreate";
import {useBucket} from "../../../contexts/BucketContext";

type TypeBucketNavigatorPopup = {
  onEdit?: () => void;
  onDelete?: () => void;
  bucket: BucketType;
};
const BucketNavigatorPopup: FC<TypeBucketNavigatorPopup> = ({
  onEdit,
  onDelete,
  bucket
}) => {
  const {categories, changeCategory} = useBucket();
  const {openDrawer, closeDrawer} = useDrawerController();

  const handleAddToCategory = () => {
    openDrawer(
      <CategorySelectCreate
        changeCategory={changeCategory}
        bucketId={bucket._id}
        categories={categories}
        onSubmit={closeDrawer}
      />
    );
  };
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
            onClick={handleAddToCategory}
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
