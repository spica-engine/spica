import {Button, FlexElement, Icon, Popover, Text, useOnClickOutside} from "oziko-ui-kit";
import {memo, useRef, useState, type FC} from "react";
import styles from "./BucketNavigatorPopup.module.scss";
import Confirmation from "../confirmation/Confirmation";
import type {BucketType} from "../../../services/bucketService";
import CategorySelectCreate from "../category-select-create/CategorySelectCreate";
import {useBucket} from "../../../contexts/BucketContext";

type TypeBucketNavigatorPopup = {
  className?: string;
  onOpen?: () => void;
  onClose?: () => void;
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onAddToCategory?: () => void;
  onEdit?: () => void;
  bucket: BucketType;
};

const BucketNavigatorPopup: FC<TypeBucketNavigatorPopup> = ({
  onAddToCategory,
  onEdit,
  bucket,
  className,
  isOpen,
  setIsOpen
}) => {
  const containerRef = useRef(null);
  const contentRef = useRef(null);
  const [isCategorySelectCreateOpen, setIsCategorySelectCreateOpen] = useState(false);

  useOnClickOutside({
    refs: [containerRef, contentRef],
    onClickOutside: () => setIsOpen(false)
  });
  const {deleteBucket, categories, changeCategory} = useBucket();
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);

  const handleDeleteBucket = async () => {
    try {
      await deleteBucket(bucket._id);
      setIsConfirmationOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancel = () => {
    setIsConfirmationOpen(false);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`${styles.container} ${className || ""}`}>
      <Popover
        open={isOpen}
        contentProps={{
          className: styles.popoverContainer
        }}
        content={
          <FlexElement
            ref={contentRef}
            dimensionX={160}
            direction="vertical"
            className={styles.popoverContent}
          >
            <Button
              containerProps={{
                alignment: "leftCenter",
                dimensionX: "fill"
              }}
              color="default"
              onClick={e => {
                e.stopPropagation();
                setIsCategorySelectCreateOpen(true);
              }}
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
              onClick={e => {
                e.stopPropagation();
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
              onClick={e => {
                e.stopPropagation();
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
        <Button
          onClick={e => {
            e.stopPropagation();
            setIsOpen(true);
          }}
          color="transparent"
          variant="icon"
        >
          <Icon name="dotsVertical" size="sm" />
        </Button>
      </Popover>
      {isCategorySelectCreateOpen && (
        <CategorySelectCreate
          changeCategory={changeCategory}
          bucket={bucket}
          categories={categories}
          onCancel={() => {
            setIsCategorySelectCreateOpen(false);
            setIsOpen(false);
          }}
        />
      )}
      {isConfirmationOpen && (
        <Confirmation
          title="DELETE BUCKET"
          description={
            <>
              <p className={styles.confirmText}>
                This action will permanently delete this bucket and remove all associated data and
                connections. This cannot be undone.
              </p>
              <span className={styles.confirmHint}>
                Please type <strong>{bucket.title}</strong> to confirm deletion.
              </span>
            </>
          }
          inputPlaceholder="Type Here"
          confirmLabel={
            <>
              <Icon name="delete" />
              Delete
            </>
          }
          cancelLabel={
            <>
              <Icon name="close" />
              Cancel
            </>
          }
          showInput
          confirmCondition={val => val === bucket.title}
          onConfirm={handleDeleteBucket}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
};

export default memo(BucketNavigatorPopup);
