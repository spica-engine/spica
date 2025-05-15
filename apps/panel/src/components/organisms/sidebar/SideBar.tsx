import React, {type FC, type ReactNode, useState} from "react";
import styles from "./SideBar.module.scss";
import {Icon} from "oziko-ui-kit";
import type {IconName} from "../../../../../../node_modules/oziko-ui-kit/dist/utils/iconList";
import Navigator, {type TypeNavigatorHeader} from "./navigator/Navigator";
import Logo from "../../atoms/logo/Logo";

export type TypeMenuItems = {
  name?: string;
  icon?: IconName;
  header?: TypeNavigatorHeader;
  id: string;
};

export type TypeNavigatorItems = {
  _id: string;
  title?: string;
  icon?: IconName;
  category?: string;
};

type TypeSideBar = {
  menuItems?: TypeMenuItems[];
  navigatorItems?: {
    [key: string]: TypeNavigatorItems[];
  };
  logo?: string;
  footer?: ReactNode;
  toggleIconName?: IconName;
  onNavigatorToggle?: (isOpen: boolean) => void;
};

const SideBar: FC<TypeSideBar> = ({
  menuItems,
  navigatorItems,
  footer,
  toggleIconName = "chevronLeft",
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
          <Logo></Logo>
        </div>

        <div className={styles.menu}>
          {menuItems?.map((menuItems, index) => (
            <div
              key={index}
              className={`${styles.menuItem} ${activeMenu === index ? styles.active : ""}`}
              onClick={() => handleClick(index)}
            >
              <Icon name={menuItems.icon as IconName} />
            </div>
          ))}
          <div className={styles.menuItem} onClick={toggleNavigator}>
            <Icon name={toggleIconName} />
          </div>
        </div>

        {footer || <Icon name="forkRight" size="lg" className={styles.versionControl} />}
      </div>

      <div
        className={`${styles.navigatorContainer} ${showNavigator ? styles.open : styles.closed}`}
      >
        <Navigator
          header={menuItems?.[activeMenu]?.header as TypeNavigatorHeader}
          items={navigatorItems?.[menuItems![activeMenu]?.id] ?? []}
        />
      </div>
    </div>
  );
};

export default SideBar;
