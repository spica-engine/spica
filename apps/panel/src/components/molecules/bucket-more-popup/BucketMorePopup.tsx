import {Button, FlexElement, FluidContainer, Icon, Popover, Text, Checkbox} from "oziko-ui-kit";
import {
  memo,
  useMemo,
  useEffect,
  useState,
  type FC,
  useCallback,
} from "react";
import styles from "./BucketMorePopup.module.scss";
import {useUpdateBucketMutation, useDeleteBucketHistoryMutation, type BucketType} from "../../../store/api/bucketApi";
import Confirmation from "../confirmation/Confirmation";
import BucketRules from "../bucket-rules/BucketRules";
import BucketLimitationsForm, {
  LIMIT_EXCEED_BEHAVIOUR_OPTIONS,
  type TypeLimitExceedBehaviour
} from "../bucket-limitations-form/BucketLimitationsForm";

type TypeBucketMorePopup = {
  className?: string;
  bucket: BucketType;
  onOpen?: () => void;
  onClose?: () => void;
};

const BucketMorePopup: FC<TypeBucketMorePopup> = ({className, bucket}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isBucketRulesOpen, setIsBucketRulesOpen] = useState(false);
  const [isDeleteHistoryConfirmationOpen, setIsDeleteHistoryConfirmationOpen] = useState(false);
  const [deleteHistoryError, setDeleteHistoryError] = useState<null | string>(null);

  const getInitialBucketLimitations = useCallback(
    () => ({
      countLimit: bucket?.documentSettings?.countLimit,
      limitExceedBehaviour: LIMIT_EXCEED_BEHAVIOUR_OPTIONS.find(
        i => i.value === bucket?.documentSettings?.limitExceedBehaviour
      )?.label as TypeLimitExceedBehaviour
    }),
    [bucket?.documentSettings]
  );

  const [bucketLimitationValues, setBucketLimitationValues] = useState<{
    countLimit: number;
    limitExceedBehaviour: TypeLimitExceedBehaviour;
  }>(getInitialBucketLimitations);

  useEffect(() => {
    setBucketLimitationValues(getInitialBucketLimitations());
  }, [bucket]);

  const [updateBucket] = useUpdateBucketMutation();
  const [deleteBucketHistory, { isLoading: deleteBucketHistoryLoading, error: deleteBucketHistoryError }] = useDeleteBucketHistoryMutation();
  
  const isLimitationChecked = useMemo(() => Boolean(bucket?.documentSettings), [bucket]);

  const handleChangeLimitation = async () => {
    // Toggle documentSettings - if it exists, remove it; if not, add empty object
    try {
      await updateBucket({
        id: bucket._id,
        body: {
          title: bucket.title,
          description: bucket.description,
          // Note: documentSettings is not in the UpdateBucketRequest interface
          // This functionality may need to be implemented in the API
        }
      });
    } catch (error) {
      console.error('Failed to update bucket limitation:', error);
    }
  };

  const handleConfigureLimitation = async () => {
    if (!isLimitationChecked) return;
    setBucketLimitationValues(getInitialBucketLimitations());
  };

  const isHistoryChecked = useMemo(() => bucket?.history, [bucket]);
  const handleChangeHistory = async () => {
    try {
      await updateBucket({
        id: bucket._id,
        body: {
          history: !bucket.history
        }
      });
    } catch (error) {
      console.error('Failed to update bucket history:', error);
    }
  };

  useEffect(() => {
    if (deleteBucketHistoryError) {
      const errorMessage = typeof deleteBucketHistoryError === 'string' 
        ? deleteBucketHistoryError 
        : 'message' in deleteBucketHistoryError && deleteBucketHistoryError.message 
          ? deleteBucketHistoryError.message 
          : 'An error occurred';
      setDeleteHistoryError(errorMessage);
    }
  }, [deleteBucketHistoryError]);

  const handleDeleteHistory = async () => {
    try {
      const result = await deleteBucketHistory(bucket);
      if (result.data) {
        handleCloseHistoryConfirmation();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpen = () => setIsOpen(true);
  const handleClose = () => {
    setIsOpen(false);
    handleConfigureLimitation();
  };

  const handleCloseBucketRules = () => {
    setIsBucketRulesOpen(false);
    handleClose();
  };

  const handleOpenBucketRules = () => setIsBucketRulesOpen(true);

  const handleOpenDeleteHistoryConfirmation = () => setIsDeleteHistoryConfirmationOpen(true);

  const handleCloseHistoryConfirmation = () => {
    setDeleteHistoryError(null);
    setIsDeleteHistoryConfirmationOpen(false);
  };

  return (
    <div className={`${styles.container} ${className || ""}`}>
      <Popover
        open={isOpen}
        onClose={handleClose}
        contentProps={{className: styles.popoverContainer}}
        content={
          <FluidContainer
            gap={0}
            direction="vertical"
            className={styles.popoverContent}
            alignment="leftTop"
            prefix={{
              className: styles.configureRulesContainer,
              onClick: handleOpenBucketRules,
              children: (
                <FlexElement alignment="leftCenter" direction="vertical" gap={0}>
                  <Button variant="text">
                    <Icon name="security" />
                    <Text>Configure rules</Text>
                  </Button>
                </FlexElement>
              )
            }}
            root={{
              className: styles.historyContainer,
              children: (
                <FlexElement direction="vertical" alignment="leftTop" gap={0}>
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
                      onClick={handleOpenDeleteHistoryConfirmation}
                      className={styles.historyButton}
                    >
                      <Icon name="delete" className={styles.danger} />
                      <Text>Remove History</Text>
                    </Button>
                  )}
                </FlexElement>
              )
            }}
            suffix={{
              className: styles.limitationsContainer,
              children: (
                <FlexElement gap={5} direction="vertical" alignment="leftTop">
                  <Checkbox
                    label="Limitations"
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
              <span className={styles.confirmText}>This action will permanently delete the history.</span>
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
          onCancel={handleCloseHistoryConfirmation}
          error={deleteHistoryError}
        />
      )}
      {isBucketRulesOpen && <BucketRules bucket={bucket} onClose={handleCloseBucketRules} />}
    </div>
  );
};

export default memo(BucketMorePopup);
