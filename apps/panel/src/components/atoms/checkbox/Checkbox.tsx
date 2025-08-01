import React, {
  type ChangeEventHandler,
  type FC,
  memo,
  type ReactNode,
  useRef,
  useEffect,
  useId
} from "react";
import clsx from "clsx";
import styles from "./Checkbox.module.scss";
import {type TypeFluidContainer, FluidContainer, Text, type TypeText} from "oziko-ui-kit";

export type TypeCheckbox = {
  checked?: boolean;
  disabled?: boolean;
  label?: ReactNode;
  indeterminate?: boolean;
  labelProps?: TypeText;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  id?: string;
};

const Checkbox: FC<TypeCheckbox & TypeFluidContainer> = ({
  checked = false,
  disabled = false,
  label,
  indeterminate = false,
  labelProps,
  onChange,
  id,
  prefix: incomingPrefix = {},
  root: incomingRoot = {},
  ...props
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const generatedId = useId();

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  const handleContainerClick = (e: React.MouseEvent) => {
    if (disabled) return;
    const target = e.target as HTMLElement;
    if (target.closest("input")) return;
    inputRef.current?.click();
  };

  const handleChange: ChangeEventHandler<HTMLInputElement> = e => {
    onChange?.(e);
  };

  return (
    <FluidContainer
      {...props}
      onClick={e => {
        handleContainerClick(e);
        if (typeof props.onClick === "function") props.onClick(e);
      }}
      dimensionY={36}
      className={clsx(props.className, styles.container, disabled && styles.disabled)}
      prefix={{
        children: (
          <div className={clsx(styles.checkbox, indeterminate && styles.indeterminate)}>
            <input
              id={id ?? generatedId}
              ref={inputRef}
              type="checkbox"
              checked={checked}
              onChange={handleChange}
              disabled={disabled}
              aria-checked={indeterminate ? "mixed" : checked}
            />
            <label htmlFor={id ?? generatedId} onClick={e => e.stopPropagation()} />
          </div>
        ),
        ...incomingPrefix
      }}
      root={{
        children: <Text {...labelProps}>{label}</Text>,
        ...incomingRoot
      }}
    />
  );
};

export default memo(Checkbox);
