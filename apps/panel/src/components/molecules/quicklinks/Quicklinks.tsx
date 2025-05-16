import {FlexElement} from "oziko-ui-kit";
import styles from "./Quicklinks.module.scss";
import {memo} from "react";

const currentVersion = "v0.0.0";
const Quicklinks = () => {
  return (
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
          window.open("https://www.youtube.com/playlist?list=UUCfDC3-r1tIeYfylt_9QVJg", "_blank");
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
  );
};

export default memo(Quicklinks);
