import React, {type FC, type ReactNode, useState} from "react";
import styles from "./SideBar.module.scss";
import {Icon, type IconName} from "oziko-ui-kit";
import Navigator from "./navigator/Navigator";
import Logo from "../../atoms/logo/Logo";
import type {TypeMenuItems, NavigatorItemGroup, TypeNavigatorHeader} from "../../../types/sidebar";

type TypeSideBar = {
  menuItems?: TypeMenuItems[];
  navigatorItems?: {
    [key: string]: NavigatorItemGroup;
  };
  logo?: string;
  footer?: ReactNode;
  toggleIconName?: IconName;
  displayToggleIcon?: boolean;
  onNavigatorToggle?: (isOpen: boolean) => void;
};

const SideBar: FC<TypeSideBar> = ({
  menuItems,
  navigatorItems,
  footer,
  toggleIconName = "chevronLeft",
  displayToggleIcon = true,
  onNavigatorToggle
}) => {
  const [activeMenu, setActiveMenu] = useState<number>(0);
  const [showNavigator, setShowNavigator] = useState(true);

  const handleClick = (index: number) => {
    setActiveMenu(index);
    setShowNavigator(true);
  };
  const toggleNavigator = () => {
    setShowNavigator(prev => {
      const newState = !prev;
      onNavigatorToggle?.(newState);
      return newState;
    });
  };
  return (
    <div className={styles.container}>
      <div className={styles.menuContainer}>
        <div className={styles.logo}>
          <Logo />
        </div>

        <div className={styles.menu}>
          {menuItems?.map((menuItem, index) => {
            const isActive = menuItems?.[activeMenu].id === menuItem.id;
            return (
              <div
                key={index}
                className={`${styles.menuItem} ${activeMenu === index ? styles.active : ""}`}
                onClick={() => handleClick(index)}
              >
                <Icon
                  name={menuItem.icon as IconName}
                  size={isActive ? "lg" : "md"}
                  className={isActive ? styles.activeMenuIcon : styles.deactiveMenuIcon}
                />
              </div>
            );
          })}
          {displayToggleIcon && (
            <div className={styles.menuItem} onClick={toggleNavigator}>
              <Icon name={toggleIconName} />
            </div>
          )}
        </div>

        {footer || <Icon name="forkRight" size={24} className={styles.versionControl} />}
      </div>

      <div
        className={`${styles.navigatorContainer} ${showNavigator ? styles.open : styles.closed}`}
      >
        <Navigator
          header={menuItems?.[activeMenu]?.header as TypeNavigatorHeader}
          items={navigatorItems?.[menuItems![activeMenu]?.id]}
          addNewButtonText={menuItems?.[activeMenu]?.addNewButtonText}
        />
      </div>
    </div>
  );
};

export default SideBar;
