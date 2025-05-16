import React, {memo, useState} from "react";
import styles from "./Home.module.scss";
import {FlexElement} from "oziko-ui-kit";
import "oziko-ui-kit/dist/index.css";
import SideBar from "../../components/organisms/sidebar/SideBar";
import Toolbar from "../../components/atoms/toolbar/Toolbar";
import ExampleVideo from "../../components/molecules/youtube-video/ExampleVideo";
import Quicklinks from "../../components/molecules/quicklinks/Quicklinks";
import WelcomeText from "../../components/atoms/welcome-text/WelcomeText";
import {menuItems, navigatorItems} from "./mock";

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
        <Toolbar></Toolbar>
        <FlexElement
          dimensionX={"fill"}
          direction="vertical"
          gap={10}
          className={styles.mainContainer}
        >
          <WelcomeText />
          <FlexElement dimensionX={"fill"}>
            <Quicklinks />
            <ExampleVideo />
          </FlexElement>
        </FlexElement>
      </div>
    </div>
  );
};

export default memo(Home);
