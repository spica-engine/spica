import {
  type FC,
  memo,
  type ReactNode,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState
} from "react";
import styles from "./Popover.module.scss";
import {
  type TypeFlexElement,
  useKeyDown,
  FlexElement,
  Portal,
  useOnClickOutside
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
  portalClassName?: string;
  onClose?: () => void;
  id: string
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
  portalClassName,
  onClose,
  id
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useImperativeHandle(
    contentProps?.ref ?? {current: null},
    () => popoverRef.current as HTMLDivElement
  );
  useImperativeHandle(
    containerProps?.ref ?? {current: null},
    () => containerRef.current as HTMLDivElement
  );

  const childrenRef = useRef<HTMLDivElement | null>(null);
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;

  const setIsOpen = useCallback(
    (newOpen: boolean) => {
      if (!isControlled) {
        setInternalOpen(newOpen);
      }
      if (newOpen === false) {
        onClose?.();
      }
    },
    [isControlled, onClose]
  );

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
    }
  });

  const {targetPosition, calculatePosition} = useAdaptivePosition({
    containerRef: childrenRef,
    targetRef: popoverRef,
    initialPlacement: placement
  });

  useOnClickOutside({
    refs: [containerRef, popoverRef],
    onClickOutside: () => {
      if (trigger === "click") {
        console.log("triggered", id)
        setIsOpen(false);
      }
    }
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
    onMouseLeave: () => trigger === "hover" && setIsOpen(false),
    onClick: () => trigger === "click" && setIsOpen(true)
  };

  return (
    <FlexElement
      {...containerProps}
      ref={containerRef}
      {...handleInteraction}
      className={`${styles.container} ${containerProps?.className || ""}`}
    >
      <FlexElement ref={childrenRef}>{children}</FlexElement>
      {isOpen && (
        <Portal className={portalClassName}>
          <FlexElement
            {...contentProps}
            ref={popoverRef}
            style={{...targetPosition, ...(contentProps?.style ?? {})}}
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
