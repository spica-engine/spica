import {memo, useState, type KeyboardEvent, type ReactNode} from "react";
import styles from "./PanelAccordion.module.scss";

type PanelAccordionProps = {
  children: ReactNode;
  className?: string;
};

type PanelAccordionItemProps = {
  header: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  variant?: "section" | "row";
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  actions?: ReactNode;
  disabled?: boolean;
  hideChevron?: boolean;
};

const PanelAccordion = ({children, className}: PanelAccordionProps) => {
  return <div className={[styles.group, className].filter(Boolean).join(" ")}>{children}</div>;
};

const PanelAccordionItemComponent = ({
  header,
  children,
  defaultOpen = false,
  variant = "section",
  className,
  headerClassName,
  bodyClassName,
  actions,
  disabled = false,
  hideChevron = false
}: PanelAccordionItemProps) => {
  const [open, setOpen] = useState(defaultOpen);

  const itemClassName = [
    styles.item,
    variant === "row" ? styles.rowItem : styles.sectionItem,
    open ? styles.open : "",
    disabled ? styles.disabled : "",
    className
  ]
    .filter(Boolean)
    .join(" ");

  const resolvedHeaderClassName = [
    styles.header,
    variant === "row" ? styles.rowHeader : styles.sectionHeader,
    headerClassName
  ]
    .filter(Boolean)
    .join(" ");

  const resolvedBodyClassName = [
    styles.body,
    variant === "row" ? styles.rowBody : styles.sectionBody,
    bodyClassName
  ]
    .filter(Boolean)
    .join(" ");

  const titleClassName = [
    styles.headerTitle,
    variant === "row" ? styles.rowTitle : styles.sectionTitle
  ].join(" ");

  const handleToggle = () => {
    if (disabled) {
      return;
    }

    setOpen(previous => !previous);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    handleToggle();
  };

  return (
    <div className={itemClassName}>
      <div
        className={resolvedHeaderClassName}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-expanded={open}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
      >
        <div className={styles.headerMain}>
          <div className={titleClassName}>{header}</div>
        </div>
        <div className={styles.headerSuffix}>
          {actions ? (
            <div className={styles.actions} onClick={event => event.stopPropagation()}>
              {actions}
            </div>
          ) : null}
          {!hideChevron ? (
            <span className={[styles.chevron, variant === "row" ? styles.rowChevron : styles.sectionChevron].join(" ")}>
              <svg width={variant === "row" ? 11 : 13} height={variant === "row" ? 11 : 13} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </span>
          ) : null}
        </div>
      </div>
      <div className={resolvedBodyClassName} aria-hidden={!open}>
        <div className={styles.bodyInner}>{children}</div>
      </div>
    </div>
  );
};

const PanelAccordionItem = memo(PanelAccordionItemComponent);

export {PanelAccordionItem};

export default memo(PanelAccordion);