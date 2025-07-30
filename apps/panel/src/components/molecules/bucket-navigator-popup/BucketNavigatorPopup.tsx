import {Button, FlexElement, Icon, Popover, Text, useOnClickOutside} from "oziko-ui-kit";
import {memo, useRef, useState, type FC} from "react";
import styles from "./BucketNavigatorPopup.module.scss";
import TitleForm from "../title-form/TitleForm";
import type {BucketType} from "../../../services/bucketService";
import {useBucket} from "../../../contexts/BucketContext";

type TypeBucketNavigatorPopup = {
  className?: string;
  onOpen?: () => void;
  onClose?: () => void;
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onAddToCategory?: () => void;
  onDelete?: () => void;
  bucket: BucketType;
  onEdit?: () => void;
};

const BucketNavigatorPopup: FC<TypeBucketNavigatorPopup> = ({
  className,
  isOpen,
  setIsOpen,
  onAddToCategory,
  onDelete,
  bucket,
  onEdit
}) => {
  const {changeBucketName} = useBucket();

  const [titleFormOpen, setTitleFormOpen] = useState(false);
  const containerRef = useRef(null);
  const contentRef = useRef(null);

  useOnClickOutside({
    refs: [containerRef, contentRef],
    onClickOutside: () => setIsOpen(false)
  });

  const handleChangeBucketName = async (value: string) => {
    await changeBucketName(value, bucket);
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
