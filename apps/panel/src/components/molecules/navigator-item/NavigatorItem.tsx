import React, {type FC, memo} from "react";
import styles from "./NavigatorItem.module.scss";
import {Text, Icon, FluidContainer, type TypeFluidContainer, type IconName} from "oziko-ui-kit";
import Button from "../../atoms/button/Button";

type SuffixIcon = {
  name: IconName;
  onClick?: () => void;
  ref?: React.Ref<HTMLButtonElement>;
};

type TypeNavigatorItem = {
  label: string;
  prefixIcon?: IconName;
  suffixIcons?: SuffixIcon[];
  suffixElements?: Array<React.ElementType>;
} & TypeFluidContainer;

const NavigatorItem: FC<TypeNavigatorItem> = ({
  label,
  prefixIcon,
  suffixIcons = [],
  suffixElements = [],
  ...props
}) => {

  return (
    <FluidContainer
      dimensionX={"fill"}
      dimensionY={36}
      mode="fill"
      prefix={{
        children: <Icon name={"help"} size={"md"} />
      }}
      root={{
        children: (
          <Text dimensionX={"fill"} size="medium" className={styles.label}>
            {label}
          </Text>
        )
      }}
      suffix={{
        children: (
          <>
            {
              <>
                {suffixIcons.map(({name, onClick, ref}, index) => (
                  <Button
                    key={index}
                    color="transparent"
                    className={styles.suffixButton}
                    onClick={onClick}
                    ref={ref}
                  >
                    <Icon name={name} size="sm" />
                  </Button>
                ))}
                {suffixElements.map((Element, index) => (
                  <Element key={index} className={`${styles.suffixElement}`} />
                ))}
              </>
            }
          </>
        )
      }}
      {...props}
      className={`${styles.navigatorItem} ${props.className}`}
    />
  );
};

export default memo(NavigatorItem);
