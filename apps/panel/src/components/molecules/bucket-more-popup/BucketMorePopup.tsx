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

type TypeBucketMorePopup = {
  className?: string;
  bucket: BucketType;
  onOpen?: () => void;
  onClose?: () => void;
};

const BucketMorePopup: FC<TypeBucketMorePopup> = ({className, bucket}) => {
  const [isReadOnlyLoading, setIsReadOnlyLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const contentRef = useRef(null);

  useOnClickOutside({
    refs: [containerRef, contentRef],
    onClickOutside: () => {
      setIsOpen(false);
    }
  });

  const {updateBucketReadonly} = useBucket();
  const isReadOnlyChecked = useMemo(() => bucket?.readOnly, [bucket]);

  const handleChangeReadOnly = () => {
    setIsReadOnlyLoading(true);
    updateBucketReadonly(bucket).then(() => setIsReadOnlyLoading(false));
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
                  <Checkbox label="Limitation" />
                  <Checkbox
                    label="Read Only"
                    disabled={isReadOnlyLoading}
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
    </div>
  );
};

export default memo(BucketMorePopup);
