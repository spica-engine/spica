import {
  Button,
  FlexElement,
  FluidContainer,
  Icon,
  Popover,
  Text,
  useOnClickOutside
} from "oziko-ui-kit";
import {memo, useMemo, useRef, useState, type FC} from "react";
import styles from "./BucketMorePopup.module.scss";
import type {BucketType} from "../../../services/bucketService";
import {useBucket} from "../../../contexts/BucketContext";
import Checkbox from "../../../components/atoms/checkbox/Checkbox";
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
  const [isHistoryChangeLoading, setIsHistoryChangeLoading] = useState(false);
  const containerRef = useRef(null);
  const contentRef = useRef(null);

  useOnClickOutside({
    refs: [containerRef, contentRef],
    onClickOutside: () => {
      setIsOpen(false);
    }
  });

  const {changeHistory, deleteHistory} = useBucket();
  const isHistoryChecked = useMemo(() => bucket.history, [bucket]);
  const handleChangeHistory = () => {
    setIsHistoryChangeLoading(true);
    changeHistory(bucket).then(() => {
      setIsHistoryChangeLoading(false);
    });
  };

  const handleDeleteHistory = () => {
    setIsHistoryChangeLoading(true);
    deleteHistory(bucket).then(() => {
      setIsHistoryChangeLoading(false);
      setIsHistoryConfirmationOpen(false);
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
                  {isHistoryChecked && !isHistoryChangeLoading && (
                    <Button
                      variant="text"
                      onClick={() => setIsHistoryConfirmationOpen(true)}
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
                    disabled={isHistoryChangeLoading}
                  />
                  <Checkbox label="Limitation" />
                  <Checkbox label="Read Only" />
                </FlexElement>
              )
            }}
          />
        }
      >
        <Button
          color="default"
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
          loading={isHistoryChangeLoading}
          onConfirm={handleDeleteHistory}
          onCancel={() => setIsHistoryConfirmationOpen(false)}
        />
      )}
    </div>
  );
};

export default memo(BucketMorePopup);
