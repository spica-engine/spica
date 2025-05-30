import React, {memo} from "react";
import styles from "./Home.module.scss";
import {FlexElement} from "oziko-ui-kit";
import "oziko-ui-kit/dist/index.css";
import Toolbar from "../../components/atoms/toolbar/Toolbar";
import VideoDisplay from "../../components/molecules/video-display/VideoDisplay";
import Quicklinks from "../../components/molecules/quicklinks/Quicklinks";
import WelcomeText from "../../components/atoms/welcome-text/WelcomeText";
import {token, name} from "./mock";

const Home = () => {
  return (
    <div className={styles.container}>
      <Toolbar token={token} name={name} />
      <FlexElement dimensionX="fill" direction="vertical" gap={10} className={styles.content}>
        <WelcomeText />
        <FlexElement dimensionX="fill">
          <Quicklinks />
          <VideoDisplay />
        </FlexElement>
      </FlexElement>
    </div>
  );
};

export default memo(Home);
