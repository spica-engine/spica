import {FlexElement} from "oziko-ui-kit";
import styles from "./WelcomeText.module.scss";
import {memo} from "react";
const WelcomeText = () => {
  return (
    <FlexElement className={styles.welcomeText} dimensionX={"fill"} alignment="leftTop">
      Welcome back, <span className={styles.userName}>Spica</span>
    </FlexElement>
  );
};

export default memo(WelcomeText);
