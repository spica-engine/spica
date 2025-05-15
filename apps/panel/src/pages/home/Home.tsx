import React, {memo, useState} from "react";
import styles from "./Home.module.scss";
import {FlexElement} from "oziko-ui-kit";
import "oziko-ui-kit/dist/index.css";
import SideBar, {
  type TypeMenuItems,
  type TypeNavigatorItems
} from "../../components/organisms/sidebar/SideBar";
import Toolbar from "../../components/atoms/toolbar/Toolbar";

//Mock Data for Menu and Sidebar
const menuItems: TypeMenuItems[] = [
  {
    id: "dashboard",
    name: "Dashboard",
    icon: "dashboard"
  },
  {
    id: "assetstore",
    name: "Assetstore",
    icon: "assetstore"
  },
  {
    id: "bucket",
    name: "Bucket",
    icon: "bucket"
  },
  {
    id: "identity",
    name: "Identity",
    icon: "identities"
  },
  {
    id: "function",
    name: "Function",
    icon: "function"
  },
  {
    id: "webhook",
    name: "Webhook",
    icon: "webhook"
  },
  {
    id: "storage",
    name: "Storage",
    icon: "storage"
  }
];

const navigatorItems: {[key: string]: TypeNavigatorItems[]} = {
  dashboard: [
    {_id: "1", title: "Overview", icon: "dashboard"},
    {_id: "2", title: "Analytics", icon: "dashboard"}
  ],
  bucket: [
    {_id: "3", title: "Profile", icon: "bucket"},
    {_id: "4", title: "Security", icon: "lock"}
  ]
};
const name = "Spica";
const jwt = "PlaceholderJWT123";
const currentVersion = "v0.0.0";

const Home = () => {
  const [navigatorOpen, setNavigatorOpen] = useState(true);

  return (
    <div className={styles.container}>
      <SideBar
        menuItems={menuItems}
        navigatorItems={navigatorItems}
        onNavigatorToggle={setNavigatorOpen}
      />
      <div
        className={`${styles.content} ${navigatorOpen ? styles.navigatorOpen : styles.navigatorClosed}`}
      >
        <Toolbar token={jwt} name={name}></Toolbar>
        <FlexElement
          dimensionX={"fill"}
          direction="vertical"
          gap={10}
          className={styles.mainContainer}
        >
          <FlexElement className={styles.welcomeText} dimensionX={"fill"} alignment="leftTop">
            Welcome back, <span className={styles.userName}>{name}</span>
          </FlexElement>
          <FlexElement dimensionX={"fill"}>
            <FlexElement
              className={styles.quickLinks}
              dimensionX={"fill"}
              direction="vertical"
              alignment="leftTop"
              dimensionY={"fill"}
              gap={10}
            >
              <h1 className={styles.title}>Quicklinks</h1>
              <a
                className={styles.links}
                onClick={() => {
                  window.open("https://spicaengine.com/docs/guide/getting-started", "_blank");
                }}
              >
                Documentation
              </a>
              <a
                className={styles.links}
                onClick={() => {
                  window.open("https://github.com/spica-engine/spica", "_blank");
                }}
              >
                Github
              </a>
              <a
                className={styles.links}
                onClick={() => {
                  window.open(
                    "https://www.youtube.com/playlist?list=UUCfDC3-r1tIeYfylt_9QVJg",
                    "_blank"
                  );
                }}
              >
                Youtube
              </a>
              <a
                className={styles.links}
                onClick={() => {
                  window.open("https://github.com/spica-engine/spica/releases", "_blank");
                }}
              >
                Releases (Current release {currentVersion})
              </a>
            </FlexElement>
            <FlexElement dimensionX={"fill"}>
              <iframe
                className={styles.video}
                width="100%"
                height="175"
                src="https://www.youtube.com/embed/UKpyAcaZCpU?list=UUCfDC3-r1tIeYfylt_9QVJg"
                title="Simple Identity Management + Angular | Spica Examples 2"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              ></iframe>
            </FlexElement>
          </FlexElement>
        </FlexElement>
      </div>
    </div>
  );
};

export default memo(Home);
