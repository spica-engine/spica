import {FlexElement} from "oziko-ui-kit";
import styles from "./ExampleVideo.module.scss";
import {memo} from "react";
const ExampleVideo = () => {
  return (
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
  );
};

export default memo(ExampleVideo);
