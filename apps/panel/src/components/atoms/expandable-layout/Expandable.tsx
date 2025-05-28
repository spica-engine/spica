import React, {memo, type FC} from "react";
import styles from "./Expandable.module.scss";
import {useEffect, useRef, useState} from "react";
import {Button, Icon} from "oziko-ui-kit";

type TypeExpandableSection = {
  title?: string;
  children?: React.ReactNode;
  defaultOpen?: boolean;
  containerClassName?: string;
  contentClassName?: string;
};

const Expandable: FC<TypeExpandableSection> = ({
  title,
  children,
  defaultOpen = true,
  containerClassName,
  contentClassName
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<string | number>(defaultOpen ? "auto" : 0);

  useEffect(() => {
    const contentEl = contentRef.current;
    if (!contentEl) return;

    const fullHeight = contentEl.scrollHeight;

    if (!isOpen) {
      setHeight(fullHeight);
      requestAnimationFrame(() => setHeight(0));
      return;
    }

    setHeight(fullHeight);
    const timeout = setTimeout(() => setHeight("auto"), 300);
    return () => clearTimeout(timeout);
  }, [isOpen]);

  return (
    <div className={`${styles.container} ${containerClassName}`}>
      <Button
        containerProps={{
          dimensionX: "fill",
          mode: "fill",
          alignment: "leftCenter",
          root: {
            children: title,
            alignment: "leftCenter"
          },
          suffix: {
            children: <Icon name={isOpen ? "chevronDown" : "chevronRight"} />
          }
        }}
        fullWidth
        dimensionX={"fill"}
        color="default"
        className={styles.title}
        onClick={() => setIsOpen(prev => !prev)}
      ></Button>
      <div className={styles.contentWrapper} style={{height}} ref={contentRef}>
        <div className={`${contentClassName}`}>{children}</div>
      </div>
    </div>
  );
};

export default memo(Expandable);
