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
          children: <Icon name={prefixIcon} />
        }
      }
      root={{
        children: <Text dimensionX={"fill"}>{label}</Text>
      }}
      suffix={{
        children: suffixIcons.length > 0 && (
          <>
            {suffixIcons.map(({name, onClick}, index) => (
              <Button
                key={index}
                color="transparent"
                className={styles.suffixButton}
                onClick={onClick}
              >
                <Icon name={name} />
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
