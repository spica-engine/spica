import {FlexElement} from "oziko-ui-kit";
import styles from "./Quicklinks.module.scss";
import {memo, type FC} from "react";
import {environment} from "environment";

type TypeQuicklinks = {
  currentVersion?: string;
};

const Quicklinks: FC<TypeQuicklinks> = ({currentVersion = "v0.0.0"}) => {
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
          window.open(environment.SPICA_DOCS_URL, "_blank");
        }}
      >
        Documentation
      </a>
      <a
        className={styles.links}
        onClick={() => {
          window.open(environment.SPICA_GITHUB_URL, "_blank");
        }}
      >
        Github
      </a>
      <a
        className={styles.links}
        onClick={() => {
          window.open(environment.SPICA_YOUTUBE_EXAMPLE_URL, "_blank");
        }}
      >
        Youtube
      </a>
      <a
        className={styles.links}
        onClick={() => {
          window.open(environment.SPICA_RELEASES_URL, "_blank");
        }}
      >
        Releases (Current release {currentVersion})
      </a>
    </FlexElement>
  );
};

export default memo(Quicklinks);
