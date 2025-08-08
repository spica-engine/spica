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
import {useBucket} from "../../../contexts/BucketContext";
import type {BucketType} from "src/services/bucketService";
import BucketLimitationsModal from "../bucket-limitations-modal/BucketLimitationsModal";

type TypeBucketMorePopup = {
  className?: string;
  onOpen?: () => void;
  bucket: BucketType;
  onClose?: () => void;
};

const BucketMorePopup: FC<TypeBucketMorePopup> = ({className, bucket}) => {
  const [isLimitationLoading, setIsLimitationLoading] = useState(false);
  const [isLimitationsModalOpen, setIsLimitationsModalOpen] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const contentRef = useRef(null);

  useOnClickOutside({
    refs: [containerRef, contentRef],
    onClickOutside: () => {
      setIsOpen(false);
    }
  });

  const {updateBucketLimitation, updateBucketLimitationFields} = useBucket();
  const isLimitationChecked = useMemo(() => Boolean(bucket?.documentSettings), [bucket]);

  const handleChangeLimitation = () => {
    setIsLimitationLoading(true);
    updateBucketLimitation(bucket).then(() => {
      setIsLimitationLoading(false);
    });
  };

  const handleConfigureLimitation = (
    countLimit: number,
    limitExceedBehaviour: "prevent" | "remove"
  ) => {
    setIsLimitationLoading(true);
    updateBucketLimitationFields(bucket, countLimit, limitExceedBehaviour).then(() => {
      setIsLimitationLoading(false);
      setIsLimitationsModalOpen(false);
    });
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
                  {isLimitationChecked && !isLimitationLoading && (
                    <Button
                      variant="text"
                      className={styles.limitationsPopupButton}
                      onClick={() => setIsLimitationsModalOpen(true)}
                    >
                      <Icon name="lock" />
                      <Text>Configure limitations</Text>
                    </Button>
                  )}
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
                    disabled={isLimitationLoading}
                    checked={isLimitationChecked}
                    onChange={handleChangeLimitation}
                  />
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
      {isLimitationsModalOpen && (
        <BucketLimitationsModal
          onClose={() => setIsLimitationsModalOpen(false)}
          bucket={bucket}
          onSubmit={handleConfigureLimitation}
          loading={isLimitationLoading}
        />
      )}
    </div>
  );
};

export default memo(BucketMorePopup);
