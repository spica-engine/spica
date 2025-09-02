import {Button, FlexElement, Icon, Popover, Text} from "oziko-ui-kit";
import {memo, useRef, useState, type FC} from "react";
import styles from "./BucketNavigatorPopup.module.scss";
import Confirmation from "../confirmation/Confirmation";
import TitleForm from "../title-form/TitleForm";
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
  className,
  isOpen,
  setIsOpen,
  onAddToCategory,
  bucket,
  onEdit
}) => {

  const [titleFormOpen, setTitleFormOpen] = useState(false);
  const containerRef = useRef(null);
  const contentRef = useRef(null);
  const [isCategorySelectCreateOpen, setIsCategorySelectCreateOpen] = useState(false);

  const {deleteBucket, bucketCategories, changeBucketCategory, renameBucket} = useBucket();
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);

  const handleDeleteBucket = async () => {
    deleteBucket(bucket._id);
    setIsConfirmationOpen(false);
  };

  const handleOpenCategorySelectCreate = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    e.preventDefault();
    setIsCategorySelectCreateOpen(true);
  };

  const handleOpenConfirmation = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    e.stopPropagation();
    setIsConfirmationOpen(true);
  };

  const handleCancelConfirmation = () => {
    setIsConfirmationOpen(false);
    setIsOpen(false);
  };

  const handleCancelCategorySelectCreate = () => {
    setIsCategorySelectCreateOpen(false);
    setIsOpen(false);
  };

  const handleChangeBucketName = async (value: string) => {
    await renameBucket(value, bucket);
  };

  const handleOpenEdit = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    event.stopPropagation();
    setTitleFormOpen(true);
    setIsOpen(false);
  };
  return (
    <div ref={containerRef} className={`${styles.container} ${className || ""}`}>
      <Popover
        open={isOpen}
        contentProps={{
          className: styles.popoverContainer
        }}
        onClose={() => setIsOpen(false)}
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
              onClick={handleOpenCategorySelectCreate}
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
              onClick={handleOpenEdit}
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
              onClick={handleOpenConfirmation}
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
          changeCategory={changeBucketCategory}
          bucket={bucket}
          categories={bucketCategories}
          onCancel={handleCancelCategorySelectCreate}
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
          onCancel={handleCancelConfirmation}
        />
      )}
      {titleFormOpen && (
        <TitleForm
          initialValue={bucket.title}
          onClose={() => setTitleFormOpen(false)}
          onSubmit={handleChangeBucketName}
        />
      )}
    </div>
  );
};

export default memo(BucketNavigatorPopup);