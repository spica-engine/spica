import React, {type FC, memo, useState} from "react";
import styles from "./NavigatorItem.module.scss";
import {
  Button,
  Text,
  Icon,
  FluidContainer,
  type TypeFluidContainer,
  type IconName
} from "oziko-ui-kit";
import BucketNavigatorPopup from "../bucket-navigator-popup/BucketNavigatorPopup";
import type {BucketType} from "src/services/bucketService";

type SuffixIcon = {
  name: IconName;
  onClick?: () => void;
};

type TypeNavigatorItem = {
  label: string;
  prefixIcon?: IconName;
  suffixIcons?: SuffixIcon[];
  bucket: BucketType;
} & TypeFluidContainer;

const NavigatorItem: FC<TypeNavigatorItem> = ({
  label,
  prefixIcon,
  bucket,
  suffixIcons = [],
  ...props
}) => {

  const [isPopupOpen, setIsPopupOpen]  = useState(false)

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
        children: (
          <>
            {suffixIcons.length > 0 && (
              <>
                {suffixIcons.map(({name, onClick}, index) => (
                  <Button
                    key={index}
                    color="transparent"
                    className={styles.suffixButton}
                    onClick={onClick}
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
