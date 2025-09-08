import {
  Button,
  FlexElement,
  FluidContainer,
  Icon,
  Popover,
  Text,
  Checkbox,
  useOnClickOutside
} from "oziko-ui-kit";
import {memo, useMemo, useEffect, useRef, useState, type FC, useCallback} from "react";
import styles from "./BucketMorePopup.module.scss";
import {useBucket} from "../../../contexts/BucketContext";
import type {BucketType} from "src/services/bucketService";
import BucketLimitationsForm from "../bucket-limitations-form/BucketLimitationsForm";
import Confirmation from "../confirmation/Confirmation";
import BucketRules from "../bucket-rules/BucketRules";

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
      LIMIT_EXCEED_BEHAVIOUR_OPTIONS.find(
        i => i.label === bucketLimitationValues.limitExceedBehaviour
      )?.value as TypeLimitExceedBehaviour
    );
    if (!success) setBucketLimitationValues(getInitialBucketLimitations());
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

  const handleOpen = () => setIsOpen(true);

  return (
    <div className={`${styles.container} ${className || ""}`}>
      <Popover
        open={isOpen}
        contentProps={{className: styles.popoverContainer}}
        content={
          <FluidContainer
            gap={0}
            direction="vertical"
            className={styles.popoverContent}
            alignment="leftTop"
            prefix={{
              className: styles.configureRulesContainer,
              children: (
                <FlexElement alignment="leftCenter" direction="vertical" gap={0}>
                  <Button variant="text" onClick={() => setIsBucketRulesOpen(true)}>
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
                      onClick={() => setIsDeleteHistoryConfirmationOpen(true)}
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
              children: (
                <FlexElement
                  gap={5}
                  direction="vertical"
                  alignment="leftTop"
                >
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
      {isBucketRulesOpen && (
        <BucketRules
          bucket={bucket}
          onClose={() => {
            setIsBucketRulesOpen(false);
            setIsOpen(false);
          }}
        />
      )}
    </div>
  );
};

export default memo(BucketMorePopup);
