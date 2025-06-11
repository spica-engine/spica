import {Button, FlexElement, Icon, Popover, Switch, type TypeSwitch} from "oziko-ui-kit";
import React, {memo, type FC} from "react";
import styles from "./ProfilePopover.module.scss";
import MenuGroup from "../../../components/organisms/menu-group/MenuGroup";
type TypeProfilePopover = {
  profileOnClick?: () => void;
  logoutOnClick?: () => void;
  theme?: "Light" | "Dark";
  switchProps: TypeSwitch;
};
const ProfilePopover: FC<TypeProfilePopover> = ({
  profileOnClick = () => {},
  logoutOnClick = () => {},
  theme = "Light",
  switchProps
}) => {
  return (
    <Popover
      contentProps={{
        className: styles.popoverContainer
      }}
      content={
        <MenuGroup
          options={{
            profile: {
              value: (
                <FlexElement alignment="leftCenter" dimensionX={"fill"} dimensionY={"hug"}>
                  <span className={styles.theme}> {theme}</span>
                  <Switch {...switchProps}></Switch>
                </FlexElement>
              ),
              className: styles.themeContainer
            },
            settings: {
              value: (
                <FlexElement direction="vertical" dimensionX={"fill"}>
                  <span className={styles.settings} onClick={profileOnClick}>
                    Profile
                  </span>
                  <span className={styles.settings} onClick={logoutOnClick}>
                    Logout
                  </span>
                </FlexElement>
              ),
              className: styles.settingsContainer,
              alignment: "leftCenter"
            }
          }}
        ></MenuGroup>
      }
    >
      <Button variant="icon" shape="circle" className={styles.button} onClick={() => {}}>
        <Icon name={"person"}></Icon>
      </Button>
    </Popover>
  );
};

export default memo(ProfilePopover);
