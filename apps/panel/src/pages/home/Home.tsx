import React, {memo} from "react";
import styles from "./Home.module.scss";
import {FlexElement} from "oziko-ui-kit";
import "oziko-ui-kit/dist/index.css";
import VideoDisplay from "../../components/molecules/video-display/VideoDisplay";
import Quicklinks from "../../components/molecules/quicklinks/Quicklinks";
import WelcomeText from "../../components/atoms/welcome-text/WelcomeText";
import BucketNavigatorPopup from "../../components/molecules/bucket-navigator-popup/BucketNavigatorPopup";
import {useBucket} from "../../contexts/BucketContext";

const Home = () => {
  const {buckets} = useBucket();
  const myBucket = buckets?.[0];

  return (
    <div className={styles.container}>
      <FlexElement dimensionX="fill" direction="vertical" gap={10} className={styles.content}>
        <WelcomeText />
        <FlexElement dimensionX="fill">
          <Quicklinks />
          <VideoDisplay />
        </FlexElement>
        MyBucket: {JSON.stringify(myBucket)}
        {myBucket && <BucketNavigatorPopup bucket={myBucket} />}
      </FlexElement>
    </div>
  );
};

export default memo(Home);
