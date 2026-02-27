import React from "react";
import styles from "../Navigation.module.scss";
import {FluidContainer, Text} from "oziko-ui-kit";
import type {NavigationPrefabProps} from "../navigation-registry";

const VersionControlNavigation: React.FC<NavigationPrefabProps> = () => {
  return (
    <div className={styles.container}>
      <FluidContainer
        dimensionX={"fill"}
        mode={"fill"}
        className={styles.header}
        root={{
          children: (
            <Text dimensionX={"fill"} size="large">
              GIT (Version Control)
            </Text>
          )
        }}
      />
    </div>
  );
};

export default VersionControlNavigation;
