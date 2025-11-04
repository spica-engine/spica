import React, {useEffect, useMemo, useState, useRef} from "react";
import {Outlet, useNavigate} from "react-router-dom";
import SideBar from "../components/organisms/sidebar/SideBar";
import type {NavigatorItemGroup, TypeNavigatorItem} from "../types/sidebar";

import styles from "./Layout.module.scss";
import {Drawer} from "oziko-ui-kit";
import Toolbar from "../components/atoms/toolbar/Toolbar";
import useLocalStorage from "../hooks/useLocalStorage";
import {jwtDecode} from "jwt-decode";
import type {AuthTokenJWTPayload} from "src/types/auth";
import {useGetBucketsQuery, useUpdateBucketOrderMutation} from "../store/api/bucketApi";
import {useRequestTracker} from "../hooks/useRequestTracker";
import {
  BucketNavigatorPopupWrapper,
  type BucketNavigatorPopupWrapperProps
} from "./components/BucketNavigatorPopupWrapper";
import { getMenuItems, navigatorItems } from "../pages/home/sidebarItems";

const Layout = () => {
  const navigate = useNavigate();
  const [token] = useLocalStorage<string>("token", "");

  const [navigatorOpen, setNavigatorOpen] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const {data: buckets = [], refetch: getBuckets} = useGetBucketsQuery();

  const [updateBucketOrder] = useUpdateBucketOrderMutation();

  const memoizedBuckets = useMemo(() => buckets, [JSON.stringify(buckets.map(b => b._id))]);

  const [localBuckets, setLocalBuckets] = useState(memoizedBuckets);

  useEffect(() => {
    setLocalBuckets(memoizedBuckets);
  }, [memoizedBuckets]);

  const updateBucketOrderLocally = (from: number, to: number) => {
    const updated = [...localBuckets];
    const [moved] = updated.splice(from, 1);
    updated.splice(to, 0, moved);
    setLocalBuckets(updated);
  };

  const updateBucketOrderOnServer = async (bucketId: string, order: number) => {
    try {
      await updateBucketOrder({bucketId, order});
    } catch (error) {
      console.error("Failed to update bucket order:", error);
      setLocalBuckets(memoizedBuckets);
    }
  };

  const menuItems = getMenuItems(navigate);

  const mergedNavigatorItems: {
    [key: string]: NavigatorItemGroup;
  } = {
    ...Object.fromEntries(
      Object.entries(navigatorItems).map(([key, value]) => [
        key,
        {items: value ?? [], setter: () => {}}
      ])
    ),
    bucket: {
      items: (localBuckets?.map(i => ({
        ...i,
        section: "bucket",
        link: `/bucket/${i._id}`,
        suffixElements: [
          (props: BucketNavigatorPopupWrapperProps) => (
            <BucketNavigatorPopupWrapper {...props} bucket={i} />
          )
        ]
      })) ?? []) as TypeNavigatorItem[],
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
