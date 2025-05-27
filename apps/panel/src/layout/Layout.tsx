import React, {useState} from "react";
import {Outlet} from "react-router-dom";
import SideBar from "../components/organisms/sidebar/SideBar";
import {menuItems, navigatorItems} from "../pages/home/mock";
import styles from "./Layout.module.scss";

const Layout = () => {
  const [navigatorOpen, setNavigatorOpen] = useState(true);

  return (
    <>
      <SideBar
        menuItems={menuItems}
        navigatorItems={navigatorItems}
        onNavigatorToggle={setNavigatorOpen}
      />
      <div
        className={`${styles.content} ${
          navigatorOpen ? styles.navigatorOpen : styles.navigatorClosed
        }`}
      >
        <Outlet />
      </div>
    </>
  );
};

export default Layout;
