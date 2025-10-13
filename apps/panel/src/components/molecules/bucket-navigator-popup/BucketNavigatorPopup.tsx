import {Button, FlexElement, Icon, Popover, Text} from "oziko-ui-kit";
import {memo, useRef, useState, type FC} from "react";
import styles from "./BucketNavigatorPopup.module.scss";
import Confirmation from "../confirmation/Confirmation";
import EditBucket from "../../prefabs/edit-bucket/EditBucket";
import type {BucketType} from "../../../store/api/bucketApi";
import CategorySelectCreate from "../category-select-create/CategorySelectCreate";
import {useGetBucketsQuery, useChangeBucketCategoryMutation, useRenameBucketMutation} from "../../../store/api/bucketApi";
import DeleteBucket from "../../prefabs/delete-bucket/DeleteBucket";

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
  const containerRef = useRef(null);
  const contentRef = useRef(null);
  const [isCategorySelectCreateOpen, setIsCategorySelectCreateOpen] = useState(false);

  const {data: buckets = []} = useGetBucketsQuery();
  const [changeBucketCategory] = useChangeBucketCategoryMutation();
  const [renameBucket] = useRenameBucketMutation();

  // Derive bucket categories from buckets data
  const bucketCategories = Array.from(new Set(buckets.map(bucket => bucket.category).filter(Boolean))) as string[];

  // Wrapper function to match expected signature
  const handleChangeBucketCategory = async (bucketId: string, category: string) => {
    return changeBucketCategory({ bucketId, category });
  };


  const handleOpenCategorySelectCreate = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    e.preventDefault();
    setIsCategorySelectCreateOpen(true);
  };


  const handleCancelCategorySelectCreate = () => {
    setIsCategorySelectCreateOpen(false);
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
            <EditBucket bucket={bucket}>
              {({onOpen}) => (
                <Button
                  containerProps={{
                    alignment: "leftCenter",
                    dimensionX: "fill"
                  }}
                  color="default"
                  onClick={onOpen}
                  className={styles.buttons}
                >
                  <Icon name="pencil" />
                  <Text>Edit</Text>
                </Button>
              )}
            </EditBucket>
            <DeleteBucket bucket={bucket}>
              {({onOpen}) => (
                <Button
                  containerProps={{
                    alignment: "leftCenter",
                    dimensionX: "fill"
                  }}
                  color="default"
                  onClick={onOpen}
                  className={styles.buttons}
                >
                  <Icon name="delete" className={styles.deleteIcon} />
                  <Text variant="danger">Delete</Text>
                </Button>
              )}
            </DeleteBucket>
          
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
          changeCategory={handleChangeBucketCategory}
          bucket={bucket}
          categories={bucketCategories}
          onCancel={handleCancelCategorySelectCreate}
        />
      )}
    </div>
  );
};

export default memo(BucketNavigatorPopup);
