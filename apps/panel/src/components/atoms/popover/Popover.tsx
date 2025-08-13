import {type FC, memo, type ReactNode, useEffect, useLayoutEffect, useRef, useState} from "react";
import styles from "./Popover.module.scss";
import {
  type TypeFlexElement,
  useKeyDown,
  useOnClickOutside,
  FlexElement,
  Portal
} from "oziko-ui-kit";
import useAdaptivePosition, {type Placement} from "../../../hooks/useAdaptivePosition";

export type TypePopover = {
  placement?: Placement;
  content: ReactNode;
  children?: ReactNode;
  trigger?: "hover" | "click";
  open?: boolean;
  containerProps?: TypeFlexElement;
  contentProps?: TypeFlexElement;
  arrow?: boolean;
  arrowPlacement?: Placement;
  onClose?: () => void;
};

const Popover: FC<TypePopover> = ({
  placement = "bottom",
  content,
  trigger = "click",
  children,
  open,
  containerProps,
  contentProps,
  arrow = false,
  arrowPlacement,
  onClose
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const childrenRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(open);

  const arrowplc = {
    top: "bottom",
    topStart: "bottomStart",
    topEnd: "bottomEnd",
    bottom: "top",
    bottomStart: "topStart",
    bottomEnd: "topEnd",
    left: "right",
    leftStart: "rightStart",
    leftEnd: "rightEnd",
    right: "left",
    rightStart: "leftStart",
    rightEnd: "leftEnd"
  } as const;

  useKeyDown("Escape", () => {
    if (isOpen) {
      setIsOpen(false);
      onClose?.();
    }
  });

  useEffect(() => {
    setIsOpen(open);
    if (!open) onClose?.()
  }, [open]);

  const {targetPosition, calculatePosition} = useAdaptivePosition({
    containerRef: childrenRef,
    targetRef: popoverRef,
    initialPlacement: placement
  });

  useOnClickOutside({
    refs: [containerRef, popoverRef],
    onClickOutside: () => {if (trigger === "click"){ setIsOpen(false); onClose?.()}}
  });

  useLayoutEffect(() => {
    if (isOpen) {
      calculatePosition();
    }
  }, [isOpen, calculatePosition]);

  const handleInteraction = {
    onMouseEnter: () => {
      trigger === "hover" && setIsOpen(true);
    },
    onMouseLeave: () => {
      if (trigger === "hover") {
        setIsOpen(false);
        onClose?.()
      }
    },
    onClick: () => trigger === "click" && setIsOpen(true)
  };

  return (
    <FlexElement
      ref={containerRef}
      {...handleInteraction}
      {...containerProps}
      className={styles.container}
    >
      <FlexElement ref={childrenRef}>{children}</FlexElement>
      {isOpen && (
        <Portal>
          <FlexElement
            ref={popoverRef}
            style={{...targetPosition}}
            {...contentProps}
            className={`${contentProps?.className} ${styles.content}`}
          >
            {arrow && (
              <div className={`${styles.arrow} ${styles[arrowPlacement || arrowplc[placement]]}`} />
            )}
            {content}
          </FlexElement>
        </Portal>
      )}
    </FlexElement>
  );
};

export default memo(Popover);
