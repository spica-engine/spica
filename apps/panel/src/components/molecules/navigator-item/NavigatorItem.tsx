import React, {type FC, memo} from "react";
import styles from "./NavigatorItem.module.scss";
import {
  Button,
  Text,
  Icon,
  FluidContainer,
  type TypeFluidContainer,
  type IconName
} from "oziko-ui-kit";

type SuffixIcon = {
  name: IconName;
  onClick?: () => void;
  ref?: React.Ref<HTMLButtonElement>;
};

type TypeNavigatorItem = {
  label: string;
  prefixIcon?: IconName;
  suffixIcons?: SuffixIcon[];
} & TypeFluidContainer;

const NavigatorItem: FC<TypeNavigatorItem> = ({label, prefixIcon, suffixIcons = [], ...props}) => {
  return (
    <FluidContainer
      dimensionX={"fill"}
      dimensionY={36}
      mode="fill"
      prefix={
        prefixIcon && {
          children: <Icon name={prefixIcon} size={"md"} />
        }
      }
      root={{
        children: (
          <Text dimensionX={"fill"} size="medium" className={styles.label}>
            {label}
          </Text>
        )
      }}
      suffix={{
        children: suffixIcons.length > 0 && (
          <>
            {suffixIcons.map(({name, onClick, ref}, index) => (
              <Button
                key={index}
                color="transparent"
                className={styles.suffixButton}
                onClick={onClick}
                // @ts-expect-error
                ref={(el: HTMLButtonElement) => {
                  if (ref && typeof ref === "object") {
                    (ref as React.MutableRefObject<HTMLButtonElement | null>).current = el;
                  }
                }}
              >
                <Icon name={name} size="sm" />
              </Button>
            ))}
          </>
        )
      }}
      {...props}
      className={`${styles.navigatorItem} ${props.className}`}
    />
  );
};

export default memo(NavigatorItem);
