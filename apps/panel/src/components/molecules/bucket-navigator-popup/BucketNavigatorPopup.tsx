import {Button, FlexElement, Icon, Popover, Text, useOnClickOutside} from "oziko-ui-kit";
import {memo, useRef, useState, type FC} from "react";
import styles from "./BucketNavigatorPopup.module.scss";
import type {BucketType} from "../../../services/bucketService";
import CategorySelectCreate from "../category-select-create/CategorySelectCreate";
import {useBucket} from "../../../contexts/BucketContext";

type TypeBucketNavigatorPopup = {
  className?: string;
  bucket: BucketType;
  onOpen?: () => void;
  onClose?: () => void;
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

const BucketNavigatorPopup: FC<TypeBucketNavigatorPopup> = ({
  className,
  isOpen,
  setIsOpen,
  bucket
}) => {
  const containerRef = useRef(null);
  const contentRef = useRef(null);
  const [isCategorySelectCreateOpen, setIsCategorySelectCreateOpen] = useState(false);

  useOnClickOutside({
    refs: [containerRef, contentRef],
    onClickOutside: () => setIsOpen(false)
  });
  const {categories, changeCategory} = useBucket();

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
    </div>
  );
};

export default memo(BucketNavigatorPopup);
