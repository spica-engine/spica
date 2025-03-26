import type {TypeFluidContainer} from "../../../../../../node_modules/oziko-ui-kit/dist/components/atoms/fluid-container/FluidContainer";
import React, {type FC, memo} from "react";
import styles from "./NavigatorItem.module.scss";
import type {IconName} from "../../../../../../node_modules/oziko-ui-kit/dist/utils/iconList";
import {Button, Text, Icon, FluidContainer} from "oziko-ui-kit";
import "oziko-ui-kit/dist/index.css";

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
