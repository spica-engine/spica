import {
  Button,
  FlexElement,
  FluidContainer,
  Icon,
  Text,
  Checkbox,
  Popover,
  useOnClickOutside
} from "oziko-ui-kit";
import styles from "./BucketMorePopup.module.scss";
import {useBucket} from "../../../contexts/BucketContext";
import type {BucketType} from "src/services/bucketService";
import BucketLimitationsForm from "../bucket-limitations-form/BucketLimitationsForm";
import {memo, useEffect, useMemo, useRef, useState, type FC} from "react";
import Confirmation from "../confirmation/Confirmation";

type TypeBucketMorePopup = {
  className?: string;
  bucket: BucketType;
  onOpen?: () => void;
  onClose?: () => void;
};

export type TypeLimitExceedBehaviour = "prevent" | "remove";
export const LIMIT_EXCEED_BEHAVIOUR_OPTIONS = [
  {label: "Do not insert", value: "prevent"},
  {label: "Insert but delete the oldest", value: "remove"}
] as {label: string; value: TypeLimitExceedBehaviour}[];

const BucketMorePopup: FC<TypeBucketMorePopup> = ({className, bucket}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleteHistoryConfirmationOpen, setIsDeleteHistoryConfirmationOpen] = useState(false);
  const [deleteHistoryError, setDeleteHistoryError] = useState<null | string>(null);

  const [bucketLimitationValues, setBucketLimitationValues] = useState<{
    countLimit: number;
    limitExceedBehaviour: TypeLimitExceedBehaviour;
  }>({
    countLimit: bucket?.documentSettings?.countLimit,
    limitExceedBehaviour: LIMIT_EXCEED_BEHAVIOUR_OPTIONS.find(
      i => i.value === bucket?.documentSettings?.limitExceedBehaviour
    )?.label as TypeLimitExceedBehaviour
  });

  useEffect(() => {
    setBucketLimitationValues({
      ...bucket?.documentSettings
    });
  }, [bucket]);

  const containerRef = useRef(null);
  const contentRef = useRef(null);

  useOnClickOutside({
    refs: [containerRef, contentRef],
    onClickOutside: () => {
      setIsOpen(true);
      setTimeout(() => setIsOpen(false), 0);
      if (isLimitationChecked && isOpen) {
        handleConfigureLimitation();
      }
    }
  });

  const {
    updateBucketLimitation,
    updateBucketLimitationFields,
    updateBucketHistory,
    deleteBucketHistory,
    deleteBucketHistoryLoading,
    deleteBucketHistoryError
  } = useBucket();
  const isLimitationChecked = useMemo(() => Boolean(bucket?.documentSettings), [bucket]);

  const handleChangeLimitation = () => {
    updateBucketLimitation(bucket);
  };

  const handleConfigureLimitation = async () => {
    const success = await updateBucketLimitationFields(
      bucket,
      bucketLimitationValues.countLimit,
      bucketLimitationValues.limitExceedBehaviour
    );
    if (!success)
      setBucketLimitationValues({
        ...bucket?.documentSettings
      });
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
            alignment="leftTop"
            prefix={{
              className: styles.openPopupButtonContainer,
              children: (
                <Button variant="text" className={styles.openPopupButton}>
                  <Icon name="security" />
                  <Text>Configure rules</Text>
                </Button>
              )
            }}
            root={{
              children: (
                <FlexElement
                  direction="vertical"
                  alignment="leftTop"
                  className={styles.historyContainer}
                  gap={0}
                >
                  <Checkbox
                    label="History"
                    checked={isHistoryChecked}
                    onChange={handleChangeHistory}
                    className={styles.historyCheckbox}
                    gap={10}
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
                </FlexElement>
              )
            }}
            suffix={{
              children: (
                <FlexElement
                  gap={5}
                  direction="vertical"
                  alignment="leftTop"
                  className={styles.limitationsContainer}
                >
                  <Checkbox
                    label="Limitation"
                    checked={isLimitationChecked}
                    onChange={handleChangeLimitation}
                    className={styles.limitationsCheckbox}
                    gap={10}
                  />
                  {isLimitationChecked && (
                    <BucketLimitationsForm
                      values={bucketLimitationValues}
                      setValues={setBucketLimitationValues}
                    />
                  )}
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
