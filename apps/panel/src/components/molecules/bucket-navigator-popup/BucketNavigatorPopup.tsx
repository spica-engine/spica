import {Button, FlexElement, Icon, Popover, Text, useOnClickOutside} from "oziko-ui-kit";
import {memo, useRef, useState, type FC} from "react";
import styles from "./BucketNavigatorPopup.module.scss";
import type {BucketType} from "../../../services/bucketService";
import {useBucket} from "../../../contexts/BucketContext";
import Confirmation from "../confirmation/Confirmation";

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

  useOnClickOutside({
    refs: [containerRef, contentRef],
    onClickOutside: () => setIsOpen(false)
  });

  const {deleteBucket} = useBucket();
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);

  const handleDeleteBucket = () => {
    deleteBucket(bucket._id).then(() => {
      setIsConfirmationOpen(false);
    });
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
          onCancel={() => {
            setIsConfirmationOpen(false);
            setIsOpen(false);
          }}
        />
      )}
    </div>
  );
};

export default memo(BucketNavigatorPopup);
