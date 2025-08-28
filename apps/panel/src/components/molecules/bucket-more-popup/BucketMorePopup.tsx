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
import {memo, useMemo, useEffect, useRef, useState, type FC} from "react";
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
  const [isDeleteHistoryConfirmationOpen, setIsDeleteHistoryConfirmationOpen] = useState(false);
  const [deleteHistoryError, setDeleteHistoryError] = useState<null | string>(null);

  const containerRef = useRef(null);
  const contentRef = useRef(null);

  useOnClickOutside({
    targetElements: [containerRef, contentRef],
    onClickOutside: () => {
      setIsOpen(false);
    }
  });

  const {
    updateBucketReadonly,
    updateBucketHistory,
    deleteBucketHistory,
    deleteBucketHistoryLoading,
    deleteBucketHistoryError
  } = useBucket();
  const isReadOnlyChecked = useMemo(() => bucket?.readOnly, [bucket]);

  const handleChangeReadOnly = () => {
    updateBucketReadonly(bucket)
  };
  const isHistoryChecked = useMemo(() => bucket?.history, [bucket]);
  const handleChangeHistory = () => {
    updateBucketHistory(bucket);
  };

  useEffect(() => {
    setDeleteHistoryError(deleteBucketHistoryError);
  }, [deleteBucketHistoryError]);

  const handleDeleteHistory = async () => {
    try {
      const result = await deleteBucketHistory(bucket);
      if (!result) return;
      handleCancelHistoryConfirmation();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancelHistoryConfirmation = () => {
    setDeleteHistoryError(null);
    setIsDeleteHistoryConfirmationOpen(false);
  };

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    // If a checkbox gets clicked, and the popover is closed, the isOpen stays true for some reason and the popover doesn't open
    // This is a workaround, how popover open state is handled needs to be rethinked
    if (isOpen) {
      setIsOpen(false);
      setTimeout(() => setIsOpen(true), 0);
    } else setIsOpen(true);
  };

  return (
    <div ref={containerRef} className={`${styles.container} ${className || ""}`}>
      <Popover
        open={isOpen}
        contentProps={{className: styles.popoverContainer}}
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
                      onClick={() => setIsDeleteHistoryConfirmationOpen(true)}
                      className={styles.historyButton}
                    >
                      <Icon name="delete" />
                      <Text>Remove History</Text>
                    </Button>
                  )}
                  <Checkbox label="Limitation" />

                  <Checkbox
                    label="Read Only"
                    checked={isReadOnlyChecked}
                    onChange={handleChangeReadOnly}
                  />
                </FlexElement>
              )
            }}
          />
        }
      >
        <Button variant="text" onClick={handleOpen}>
          <Icon name="dotsVertical" />
          More
        </Button>
      </Popover>
      {isDeleteHistoryConfirmationOpen && (
        <Confirmation
          title="DELETE HISTORY"
          inputPlaceholder="Type Here"
          description={
            <>
              <p className={styles.confirmText}>This action will permanently delete the history.</p>
              <span>
                Please type <strong>Delete History</strong> to confirm deletion.
              </span>
            </>
          }
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
          confirmCondition={input => input === "Delete History"}
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
