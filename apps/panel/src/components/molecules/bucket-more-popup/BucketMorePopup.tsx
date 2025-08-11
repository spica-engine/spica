import {
  Button,
  FlexElement,
  FluidContainer,
  Icon,
  Popover,
  Text,
  useOnClickOutside,
  Checkbox
} from "oziko-ui-kit";
import {memo, useMemo, useRef, useState, type FC} from "react";
import styles from "./BucketMorePopup.module.scss";
import type {BucketType} from "../../../services/bucketService";
import {useBucket} from "../../../contexts/BucketContext";
import Confirmation from "../confirmation/Confirmation";

type TypeBucketMorePopup = {
  className?: string;
  bucket: BucketType;
  onOpen?: () => void;
  onClose?: () => void;
};

const BucketMorePopup: FC<TypeBucketMorePopup> = ({className, bucket}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isHistoryConfirmationOpen, setIsHistoryConfirmationOpen] = useState(false);
  const [deleteHistoryError, setDeleteHistoryError] = useState<null | string>(null);
  const containerRef = useRef(null);
  const contentRef = useRef(null);

  useOnClickOutside({
    refs: [containerRef, contentRef],
    onClickOutside: () => {
      setIsOpen(false);
    }
  });

  const {
    updateBucketHistory,
    deleteBucketHistory,
    deleteBucketHistoryLoading,
    deleteBucketHistoryError
  } = useBucket();

  const isHistoryChecked = useMemo(() => bucket?.history, [bucket]);
  const handleChangeHistory = () => {
    updateBucketHistory(bucket);
  };

  const handleDeleteHistory = async () => {
    try {
      await deleteBucketHistory(bucket);
      if (deleteBucketHistoryError) {
        setDeleteHistoryError(deleteBucketHistoryError);
        return;
      }
      handleCancelHistoryConfirmation();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancelHistoryConfirmation = () => {
    setDeleteHistoryError(null);
    setIsHistoryConfirmationOpen(false);
  };

  console.log(deleteBucketHistoryError);

  return (
    <div ref={containerRef} className={`${styles.container} ${className || ""}`}>
      <Popover
        open={isOpen}
        contentProps={{
          className: styles.popoverContainer
        }}
        content={
          <FluidContainer
            ref={contentRef}
            gap={0}
            direction="vertical"
            className={styles.popoverContent}
            prefix={{
              className: styles.popoverButtonsContainer,
              children: (
                <FlexElement
                  alignment="leftCenter"
                  direction="vertical"
                  gap={0}
                  className={styles.popoverButtons}
                >
                  <Button variant="text">
                    <Icon name="formatSize" />
                    <Text>Configure the view</Text>
                  </Button>
                  <Button variant="text" className={styles.openPopupButton}>
                    <Icon name="security" />
                    <Text>Configure rules</Text>
                  </Button>
                </FlexElement>
              )
            }}
            suffix={{
              className: styles.popoverCheckboxesContainer,
              children: (
                <FlexElement
                  className={styles.popoverCheckboxes}
                  alignment="leftCenter"
                  direction="vertical"
                  gap={0}
                >
                  <Checkbox
                    label="History"
                    checked={isHistoryChecked}
                    onChange={handleChangeHistory}
                  />
                  {isHistoryChecked && (
                    <Button
                      variant="text"
                      onClick={() => setIsHistoryConfirmationOpen(true)}
                      className={styles.historyButton}
                    >
                      <Icon name="delete" />
                      <Text>Remove History</Text>
                    </Button>
                  )}
                  <Checkbox label="Limitation" />
                  <Checkbox label="Read Only" />
                </FlexElement>
              )
            }}
          />
        }
      >
        <Button
          variant="text"
          onClick={e => {
            e.stopPropagation();
            // If a checkbox gets clicked, and the popover is closed, the isOpen stays true for some reason and the popover doesn't open
            // This is a workaround, how popover open state is handled needs to be rethinked
            if (isOpen) {
              setIsOpen(false);
              setTimeout(() => setIsOpen(true), 0);
            } else setIsOpen(true);
          }}
        >
          <Icon name="dotsVertical" />
          More
        </Button>
      </Popover>
      {isHistoryConfirmationOpen && (
        <Confirmation
          title="DELETE HISTORY"
          description="This action will permanently delete the history."
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
          showInput={false}
          loading={deleteBucketHistoryLoading}
          onConfirm={handleDeleteHistory}
          onCancel={handleCancelHistoryConfirmation}
          error={deleteHistoryError}
        />
      )}
    </div>
  );
};

export default memo(BucketMorePopup);
