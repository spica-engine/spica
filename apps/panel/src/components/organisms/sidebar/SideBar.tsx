import React, {type FC, useMemo, useState} from "react";
import {useNavigate} from "react-router-dom";
import styles from "./SideBar.module.scss";
import {Button, Icon, type IconName} from "oziko-ui-kit";
import Logo from "../../atoms/logo/Logo";
import {getNavigationComponent} from "../../../components/prefabs/navigations/navigation-registry";
import {sideBarItems, type SideBarItem} from "../../../pages/home/sidebarItems";

type TypeSideBar = {
  toggleIconName?: IconName;
  onNavigatorToggle?: (isOpen: boolean) => void;
};

const SideBar: FC<TypeSideBar> = ({
  toggleIconName = "chevronLeft",
  onNavigatorToggle
}) => {
  const navigate = useNavigate();
  const [showNavigator, setShowNavigator] = useState(true);
  const [activeSideBarItem, setActiveSideBarItem] = useState<SideBarItem>(sideBarItems[0]);

  const {mainItems, bottomItems} = useMemo(() => {
    const main: SideBarItem[] = [];
    const bottom: SideBarItem[] = [];
    for (const item of sideBarItems) {
      if (item.position === "bottom") {
        bottom.push(item);
      } else {
        main.push(item);
      }
    }
    return {mainItems: main, bottomItems: bottom};
  }, []);

  const handleItemClick = (item: SideBarItem) => {
    setShowNavigator(true);
    setActiveSideBarItem(item);
    if (item.route) {
      navigate(item.route);
    }
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
          {mainItems.map((item) => {
            const isActive = activeSideBarItem.id === item.id;
            return (
              <button
                key={item.id}
                className={`${styles.menuItem} ${isActive ? styles.active : ""}`}
                onClick={() => handleItemClick(item)}
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

        {bottomItems.map((item) => {
          const isActive = activeSideBarItem.id === item.id;
          return (
            <Button 
              variant="icon"
              key={item.id}
              className={`${styles.menuItem} ${isActive ? styles.active : ""}`}
              onClick={() => handleItemClick(item)}
            >
              <Icon
                name={item.icon}
                size="lg"
                className={isActive ? styles.activeMenuIcon : styles.deactiveMenuIcon}
              />
            </Button>
          );
        })}
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
