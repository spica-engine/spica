import {Button, FlexElement, FluidContainer, Icon, Text, Checkbox, Popover, useOnClickOutside} from "oziko-ui-kit";
import {memo, useMemo, useRef, useState, type FC} from "react";
import styles from "./BucketMorePopup.module.scss";
import {useBucket} from "../../../contexts/BucketContext";
import type {BucketType} from "src/services/bucketService";
import BucketLimitationsForm from "../bucket-limitations-form/BucketLimitationsForm";

type TypeBucketMorePopup = {
  className?: string;
  onOpen?: () => void;
  bucket: BucketType;
  onClose?: () => void;
};

const BucketMorePopup: FC<TypeBucketMorePopup> = ({className, bucket}) => {
  const [isLimitationsVisible, setIsLimitationsVisible] = useState(false);
  const [limitationFieldsError, setLimitationFieldsError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const contentRef = useRef(null);

  useOnClickOutside({
    refs: [containerRef, contentRef],
    onClickOutside: () => {
      setIsOpen(false);
      setIsLimitationsVisible(false);
      setLimitationFieldsError(null);
    }
  });

  const {
    updateBucketLimitation,
    updateBucketLimitationFields,
    updateBucketLimitationFieldsError,
    updateBucketLimitationFieldsLoading
  } = useBucket();
  const isLimitationChecked = useMemo(() => Boolean(bucket?.documentSettings), [bucket]);

  const handleChangeLimitation = () => {
    updateBucketLimitation(bucket);
  };

  const handleConfigureLimitation = async (
    countLimit: number,
    limitExceedBehaviour: "prevent" | "remove"
  ) => {
    const result = await updateBucketLimitationFields(bucket, countLimit, limitExceedBehaviour);
    if (!result) setLimitationFieldsError(updateBucketLimitationFieldsError);
    else setLimitationFieldsError(null);
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
                  <Checkbox label="History" />
                  <Checkbox
                    label="Limitation"
                    //disabled={isLimitationLoading}
                    checked={isLimitationChecked}
                    onChange={handleChangeLimitation}
                  />
                  {isLimitationChecked && (
                    <Button
                      variant="text"
                      className={styles.limitationsPopupButton}
                      onClick={() => {
                        if (isLimitationsVisible) setLimitationFieldsError(null);
                        setIsLimitationsVisible(!isLimitationsVisible);
                      }}
                    >
                      <Icon name="lock" />
                      <Text>Configure limitations</Text>
                    </Button>
                  )}
                  {isLimitationChecked && isLimitationsVisible && (
                    <BucketLimitationsForm
                      bucket={bucket}
                      onSubmit={handleConfigureLimitation}
                      className={styles.bucketLimitationsForm}
                      loading={updateBucketLimitationFieldsLoading}
                      error={limitationFieldsError}
                    />
                  )}
                  <Checkbox label="Read Only" />
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
    </div>
  );
};

export default memo(BucketMorePopup);
