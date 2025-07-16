import React, {useEffect, useMemo, useState} from "react";
import {Outlet} from "react-router-dom";
import SideBar from "../components/organisms/sidebar/SideBar";
import {menuItems, navigatorItems} from "../pages/home/mock";
import styles from "./Layout.module.scss";
import {Drawer} from "oziko-ui-kit";
import Toolbar from "../components/atoms/toolbar/Toolbar";
import useLocalStorage from "../hooks/useLocalStorage";
import {jwtDecode} from "jwt-decode";
import type {AuthTokenJWTPayload} from "src/types/auth";

const Layout = () => {
  const [token] = useLocalStorage<string>("token", "");

  const [navigatorOpen, setNavigatorOpen] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const closeDrawer = () => setIsDrawerOpen(false);
  const openDrawer = () => setIsDrawerOpen(true);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 1280 && isDrawerOpen) {
        closeDrawer();
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isDrawerOpen]);

  const name = useMemo(() => {
    if (!token || !token.length) return;
    const decoded = jwtDecode<AuthTokenJWTPayload>(token);
    return decoded.identifier;
  }, [token]);

  const sideBarElement = (
    <div className={styles.sidebar}>
      <SideBar
        menuItems={menuItems}
        navigatorItems={navigatorItems}
        onNavigatorToggle={setNavigatorOpen}
      />
    </div>
  );

  const drawerSidebar = (
    <Drawer
      placement="left"
      showCloseButton={false}
      isOpen={isDrawerOpen}
      onClose={closeDrawer}
      size={260}
    >
      <SideBar
        menuItems={menuItems}
        navigatorItems={navigatorItems}
        onNavigatorToggle={setNavigatorOpen}
        displayToggleIcon={false}
      />
    </Drawer>
  );

  return (
    <div className={styles.layout}>
      {isDrawerOpen && drawerSidebar}
      <div
        className={`${styles.sidebar} ${
          navigatorOpen ? styles.navigatorOpen : styles.navigatorClosed
        }`}
      >
        {sideBarElement}
      </div>
      <div className={styles.main}>
        <div className={styles.toolbar}>
          <Toolbar token={token} name={name} onDrawerOpen={openDrawer} />
        </div>
        <div className={styles.content}>
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default Layout;
