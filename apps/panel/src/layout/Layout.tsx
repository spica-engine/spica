import React, {useEffect, useMemo, useState, useRef} from "react";
import {Outlet, useNavigate} from "react-router-dom";
import SideBar, {type ReorderableItemGroup} from "../components/organisms/sidebar/SideBar";
import {getMenuItems, navigatorItems} from "../pages/home/mock";
import styles from "./Layout.module.scss";
import {Drawer} from "oziko-ui-kit";
import Toolbar from "../components/atoms/toolbar/Toolbar";
import useLocalStorage from "../hooks/useLocalStorage";
import {jwtDecode} from "jwt-decode";
import type {AuthTokenJWTPayload} from "src/types/auth";
import { useGetBucketsQuery, useUpdateBucketOrderMutation } from "../store/api/bucketApi";
import {useRequestTracker} from "../hooks/useRequestTracker";
import { useSelector } from "react-redux";

const Layout = () => {
  const navigate = useNavigate();
  const [token] = useLocalStorage<string>("token", "");
  const sliceToken = useSelector((state: any) => state.auth.token);
  console.log("sliceToken", sliceToken);
  
  const [navigatorOpen, setNavigatorOpen] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  // Use RTK Query hooks directly
  const { data: buckets = [], refetch: getBuckets } = useGetBucketsQuery();
  console.log("buckets", buckets);
  
  const [updateBucketOrder] = useUpdateBucketOrderMutation();
  
  // Memoize buckets to prevent unnecessary re-renders
  const memoizedBuckets = useMemo(() => buckets, [JSON.stringify(buckets.map(b => b._id))]);
  
  // Local state for drag-and-drop reordering
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
      await updateBucketOrder({ bucketId, order });
    } catch (error) {
      console.error('Failed to update bucket order:', error);
      // Revert to original order on error
      setLocalBuckets(memoizedBuckets);
    }
  };

  const menuItems = getMenuItems(navigate);

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
      items: localBuckets?.map(i => ({...i, section: "bucket"})) ?? [],
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

  // RTK Query automatically fetches data on mount, no need for manual useEffect
  
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
          <Toolbar bucketId={undefined} token={token} name={name} onDrawerOpen={openDrawer} />
        </div>
        <div className={styles.content}>
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default Layout;
