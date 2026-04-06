import React, {type FC, memo} from "react";
import {Text, FlexElement, type TypeFlexElement} from "oziko-ui-kit";
import styles from "./MenuGroup.module.scss";

type TypeMenuGroup = {
  options?: Record<
    string,
    {
      label?: string;
      value?: React.ReactNode;
      className?: string;
    } & Partial<TypeFlexElement>
  >;
  showDivider?: boolean;
  showTitle?: boolean;
} & TypeFlexElement;

const MenuGroup: FC<TypeMenuGroup> = ({
  options = {},
  showDivider = true,
  showTitle = true,
  ...props
}) => {
  return (
    <FlexElement
      dimensionX={160}
      direction="vertical"
      gap={0}
      alignment="leftCenter"
      className={styles.container}
      {...props}
    >
      {Object.entries(options).map(([key, option], index, array) => {
        const {label, value, className, ...flexProps} = option;
        return (
          <FlexElement
            key={key}
            dimensionX={"fill"}
            direction="vertical"
            gap={10}
            alignment="leftCenter"
            {...flexProps}
            className={`${styles.menuSection} ${!showDivider || index === array.length - 1 ? styles.noDivider : ""} ${option.className || ""}`}
          >
            {label && <Text className={styles.label}>{label}</Text>}
            {value}
          </FlexElement>
        );
      })}
    </FlexElement>
  );
};

export default memo(MenuGroup);
