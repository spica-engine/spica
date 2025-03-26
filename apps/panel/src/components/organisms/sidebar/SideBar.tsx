import React, {type FC, type ReactNode, useState} from "react";
import styles from "./SideBar.module.scss";
import defaultLogo from "../../../assets/images/logo.png";
import {Icon} from "oziko-ui-kit";
import type {IconName} from "../../../../../../node_modules/oziko-ui-kit/dist/utils/iconList";
import Navigator, {type TypeNavigatorHeader} from "./navigator/Navigator";

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
};

const SideBar: FC<TypeSideBar> = ({menuItems, navigatorItems, logo = defaultLogo, footer}) => {
  const [activeMenu, setActiveMenu] = useState<number>(0);

  const handleClick = (index: number) => {
    setActiveMenu(index);
  };

  return (
    <div className={styles.container}>
      <div className={styles.menuContainer}>
        <div className={styles.logo}>
          <img src={logo} alt="logo" />
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
        </div>

        {footer || <Icon name="forkRight" size="lg" className={styles.versionControl} />}
      </div>

      <Navigator
        header={menuItems?.[activeMenu]?.header as TypeNavigatorHeader}
        items={navigatorItems?.[menuItems![activeMenu]?.id]}
      />
    </div>
  );
};

export default SideBar;
