import {Button, FlexElement, FluidContainer, Icon, Popover, Switch, Text, type TypeSwitch} from "oziko-ui-kit";
import React, {memo, type FC} from "react";
import styles from "./ProfilePopover.module.scss";

type TypeProfilePopover = {
  profileOnClick?: () => void;
  logoutOnClick?: () => void;
  theme?: "Light" | "Dark";
  switchProps?: TypeSwitch;
};
const ProfilePopover: FC<TypeProfilePopover> = ({
  profileOnClick = () => {},
  logoutOnClick = () => {},
  theme = "Light",
  switchProps
}) => {
  return (
    <Popover
      contentProps={{className: styles.popoverContainer}}
      content={
        <FluidContainer
          gap={0}
          direction="vertical"
          className={styles.popoverContent}
          alignment="leftTop"
          prefix={{
            className: styles.profileContainer,
            onClick: profileOnClick,
            children: (
              <Button variant="text">
                <Icon name="person" />
                <Text>Profile</Text>
              </Button>
            )
          }}
          root={{
            className: `${styles.logoutContainer}${switchProps ? ` ${styles.hasBorder}` : ""}`,
            onClick: logoutOnClick,
            children: (
              <Button variant="text">
                <Icon name="logout" />
                <Text>Logout</Text>
              </Button>
            )
          }}
          suffix={
            switchProps
              ? {
                  className: styles.themeContainer,
                  children: (
                    <FlexElement alignment="leftCenter" dimensionX="fill" dimensionY="hug">
                      <span className={styles.theme}>{theme}</span>
                      <Switch {...switchProps} />
                    </FlexElement>
                  )
                }
              : undefined
          }
        />
      }
    >
      <Button variant="icon" shape="circle" className={styles.button}>
        <Icon name="person" size="lg" />
      </Button>
    </Popover>
  );
};

export default memo(ProfilePopover);
