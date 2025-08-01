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
import {useBucket} from "../../../contexts/BucketContext";
import type {BucketType} from "src/services/bucketService";
import Checkbox from "../../../components/atoms/checkbox/Checkbox";

type TypeBucketMorePopup = {
  className?: string;
  onOpen?: () => void;
  bucket: BucketType;
  onClose?: () => void;
};

const BucketMorePopup: FC<TypeBucketMorePopup> = ({className, bucket}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const contentRef = useRef(null);

  useOnClickOutside({
    refs: [containerRef, contentRef],
    onClickOutside: () => {
      setIsOpen(false);
    }
  });

  const {changeLimitation} = useBucket();
  const isLimitationChecked = useMemo(() => Boolean(bucket.documentSettings), [bucket])

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
                    checked={isLimitationChecked}
                    onChange={() => changeLimitation(bucket)}
                  />
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
            setIsOpen(true);
          }}
        >
          <Icon name="dotsVertical" />
          More
        </Button>
      </Popover>
    </div>
  );
};

export default memo(BucketMorePopup);
