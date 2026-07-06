import {FlexElement} from "oziko-ui-kit";
import styles from "./Quicklinks.module.scss";
import {memo, type FC} from "react";
import {environment} from "../../../../environment";

type TypeQuicklinks = {
  currentVersion?: string;
};

const Quicklinks: FC<TypeQuicklinks> = ({currentVersion = "0.0.0-dev"}) => {
  return (
    <FlexElement
      className={styles.quickLinks}
      dimensionX={"fill"}
      direction="vertical"
      alignment="leftTop"
      dimensionY={"fill"}
      gap={10}
    >
      <h1 className={styles.title}>Current Release</h1>
      <a
        className={styles.links}
        onClick={() => {
          window.open(environment.SPICA_RELEASES_URL, "_blank");
        }}
      >
        {currentVersion}
      </a>
    </FlexElement>
  );
};

export default memo(Quicklinks);
