import {
  Button,
  Checkbox,
  FlexElement,
  FluidContainer,
  Icon,
  Popover,
  Text,
  useOnClickOutside
} from "oziko-ui-kit";
import {memo, useRef, useState, type FC} from "react";
import styles from "./BucketMorePopup.module.scss";
import type {BucketType} from "src/services/bucketService";
import BucketRules from "../bucket-rules/BucketRules";

type TypeBucketMorePopup = {
  className?: string;
  bucket: BucketType;
  onOpen?: () => void;
  onClose?: () => void;
};

const BucketMorePopup: FC<TypeBucketMorePopup> = ({className, bucket}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isBucketRulesOpen, setIsBucketRulesOpen] = useState(false);
  const containerRef = useRef(null);
  const contentRef = useRef(null);

  useOnClickOutside({
    refs: [containerRef, contentRef],
    onClickOutside: () => {
      setIsOpen(false);
    }
  });

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
                  <Button
                    variant="text"
                    onClick={() => setIsBucketRulesOpen(true)}
                    className={styles.openPopupButton}
                  >
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
            setIsOpen(true);
          }}
        >
          <Icon name="dotsVertical" />
          More
        </Button>
      </Popover>
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
