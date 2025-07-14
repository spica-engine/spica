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
  return (
    <div className={styles.container}>
      <FlexElement dimensionX="fill" direction="vertical" gap={10} className={styles.content}>
        <WelcomeText />
        <FlexElement dimensionX="fill">
          <Quicklinks />
          <VideoDisplay />
        </FlexElement>
      </FlexElement>
      {buckets?.map(i => (
        <div key={i._id} style={{border: "1px solid red"}}>
          <div>Bucket ID: {i._id}</div>
          <div>Data: {JSON.stringify(i)}</div>
          <BucketNavigatorPopup bucket={i} />
        </div>
      ))}
    </div>
  );
};

export default memo(Home);
