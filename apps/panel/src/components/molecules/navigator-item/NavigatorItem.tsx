import React, {type FC, memo, useState} from "react";
import styles from "./NavigatorItem.module.scss";
import BucketNavigatorPopup from "../bucket-navigator-popup/BucketNavigatorPopup";
import type {BucketType} from "src/store/api/bucketApi";
import {Text, Icon, FluidContainer, type TypeFluidContainer, type IconName} from "oziko-ui-kit";
import Button from "../../atoms/button/Button";

type SuffixIcon = {
  name: IconName;
  onClick?: () => void;
  ref?: React.Ref<HTMLButtonElement>;
};

type TypeNavigatorItem = {
  label: string;
  icon?: IconName;
  prefixIcon?: IconName;
  suffixIcons?: SuffixIcon[];
  bucket: BucketType;
} & TypeFluidContainer;

const NavigatorItem: FC<TypeNavigatorItem> = ({
  label,
  icon,
  prefixIcon,
  bucket,
  suffixIcons = [],
  ...props
}) => {
  const [isPopupOpen, setIsPopupOpen] = useState(false);

  return (
    <FluidContainer
      dimensionX={"fill"}
      dimensionY={36}
      mode="fill"
      prefix={{
        children: <Icon name={icon ?? "help"} size={"md"} />
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
            {suffixIcons.length > 0 && (
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
                <BucketNavigatorPopup
                  isOpen={isPopupOpen}
                  setIsOpen={setIsPopupOpen}
                  bucket={bucket}
                  className={styles.suffixButton}
                />
              </>
            )}
          </>
        )
      }}
      {...props}
      className={`${styles.navigatorItem} ${props.className} ${isPopupOpen && styles.popupOpen}`}
    />
  );
};

export default memo(NavigatorItem);
