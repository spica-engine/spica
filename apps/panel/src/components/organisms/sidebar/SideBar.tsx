import React, {type FC, useState} from "react";
import styles from "./SideBar.module.scss";
import {Icon, type IconName} from "oziko-ui-kit";
import Logo from "../../atoms/logo/Logo";
import {getNavigationComponent} from "../../../components/prefabs/navigations/navigation-registry";
import { sideBarItems, type SideBarItem } from "../../../pages/home/sidebarItems";

type TypeSideBar = {
  toggleIconName?: IconName;
  onNavigatorToggle?: (isOpen: boolean) => void;
};

const SideBar: FC<TypeSideBar> = ({
  toggleIconName = "chevronLeft",
  onNavigatorToggle
}) => {
  const [showNavigator, setShowNavigator] = useState(true);

  const [activeSideBarItem, setActiveSideBarItem] = useState<SideBarItem>(sideBarItems[0]);

  const handleClick = (index: number) => {
    setShowNavigator(true);
    setActiveSideBarItem(sideBarItems[index]);
  };
  const toggleNavigator = () => {
    setShowNavigator(prev => {
      const newState = !prev;
      onNavigatorToggle?.(newState);
      return newState;
    });
  };

  const NavigationComponent = activeSideBarItem 
    ? getNavigationComponent(activeSideBarItem.id)
    : null;


  return (
    <div className={styles.container}>
      <div className={styles.menuContainer}>
        <div className={styles.logo}>
          <Logo />
        </div>

        <div className={styles.menu}>
          {sideBarItems?.map((item, index) => {
            const isActive = activeSideBarItem.id === item.id;
            return (
              <button
                key={index + item.id}
                className={`${styles.menuItem} ${isActive ? styles.active : ""}`}
                onClick={() => handleClick(index)}
              >
                <Icon
                  name={item.icon}
                  size={isActive ? "lg" : "md"}
                  className={isActive ? styles.activeMenuIcon : styles.deactiveMenuIcon}
                />
              </button>
            );
          })}
            <button className={styles.menuItem} onClick={toggleNavigator}>
              <Icon name={toggleIconName} />
            </button>
        </div>

        <Icon name="forkRight" size={24} className={styles.versionControl} />
      </div>

      {showNavigator && NavigationComponent && (
        <NavigationComponent 
          menuItem={activeSideBarItem}
        />
      )}
    </div>
  );
};

export default SideBar;
