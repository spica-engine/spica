import React, {useState} from "react";
import {Outlet} from "react-router-dom";
import SideBar from "../components/organisms/sidebar/SideBar";
import {menuItems, navigatorItems} from "../pages/home/mock";
import styles from "./Layout.module.scss";
import {useUIContext} from "../context/UIContext";
import {Drawer} from "oziko-ui-kit";

const Layout = () => {
  const [navigatorOpen, setNavigatorOpen] = useState(true);
  const {isSmallScreen, isDrawerOpen, closeDrawer} = useUIContext();

  const sideBarElement = (
    <SideBar
      menuItems={menuItems}
      navigatorItems={navigatorItems}
      onNavigatorToggle={setNavigatorOpen}
    />
  );

  return (
    <>
      {isSmallScreen ? (
        <Drawer
          placement="left"
          showCloseButton={false}
          isOpen={isDrawerOpen}
          onClose={closeDrawer}
          size={260}
        >
          {sideBarElement}
        </Drawer>
      ) : (
        sideBarElement
      )}

      <div
        className={`${styles.content} ${
          isSmallScreen
            ? styles.smallScreen
            : navigatorOpen
              ? styles.navigatorOpen
              : styles.navigatorClosed
        }`}
      >
        <Outlet />
      </div>
    </>
  );
};

export default Layout;
