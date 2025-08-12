import React, {useEffect, useMemo, useState} from "react";
import {Outlet} from "react-router-dom";
import SideBar, {type ReorderableItemGroup} from "../components/organisms/sidebar/SideBar";
import {menuItems, navigatorItems} from "../pages/home/mock";
import styles from "./Layout.module.scss";
import {Drawer} from "oziko-ui-kit";
import Toolbar from "../components/atoms/toolbar/Toolbar";
import useLocalStorage from "../hooks/useLocalStorage";
import {jwtDecode} from "jwt-decode";
import type {AuthTokenJWTPayload} from "src/types/auth";
import {useBucket} from "../contexts/BucketContext";
import {useRequestTracker} from "../hooks/useRequestTracker";

const Layout = () => {
  const [token] = useLocalStorage<string>("token", "");
  const [navigatorOpen, setNavigatorOpen] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const {bucketData, buckets, getBuckets, updateBucketOrderOnServer, updateBucketOrderLocally} = useBucket();

  const mergedNavigatorItems: {
    [key: string]: ReorderableItemGroup;
  } = {
    ...Object.fromEntries(
      Object.entries(navigatorItems).map(([key, value]) => [
        key,
        {items: value ?? [], setter: () => {}}
      ])
    ),
    bucket: {
      items: buckets?.map(i => ({...i, section: "bucket"})) ?? [],
      onOrderChange: updateBucketOrderLocally,
      completeOrderChange: updateBucketOrderOnServer
    }
  };

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

  useRequestTracker();

  const name = useMemo(() => {
    if (!token || !token.length) return "";
    try {
      const decoded = jwtDecode<AuthTokenJWTPayload>(token);
      return decoded.identifier;
    } catch (err) {
      console.error(err);
      return "";
    }
  }, [token]);

  useEffect(() => {
    getBuckets();
  }, []);


  const sideBarElement = (
    <div className={styles.sidebar}>
      <SideBar
        menuItems={menuItems}
        navigatorItems={mergedNavigatorItems}
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
        navigatorItems={mergedNavigatorItems}
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
          <Toolbar bucketId={bucketData?.bucketId} token={token} name={name} onDrawerOpen={openDrawer} />
        </div>
        <div className={styles.content}>
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default Layout;
