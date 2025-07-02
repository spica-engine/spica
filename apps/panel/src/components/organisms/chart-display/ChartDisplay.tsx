import {Button, FlexElement, FluidContainer, Icon} from "oziko-ui-kit";
import React, {memo, type FC} from "react";
import styles from "./ChartDisplay.module.scss";
type TypeChartDisplay = {
  title: string;
  children?: React.ReactNode;
  buttonOnclick?: () => void;
};
const ChartDisplay: FC<TypeChartDisplay> = ({title, children, buttonOnclick}) => {
  return (
    <FlexElement className={styles.container} gap={10} direction="vertical" dimensionX={"fill"}>
      <FluidContainer
        dimensionX={"fill"}
        root={{
          dimensionX: "fill",
          alignment: "leftCenter",
          children: <span className={styles.title}>{title}</span>
        }}
        suffix={{
          children: (
            <Button
              shape="circle"
              color="default"
              variant="icon"
              onClick={buttonOnclick}
              className={styles.settingsButton}
            >
              <Icon name="cog" size={"xs"}></Icon>
            </Button>
          )
        }}
      />
      {children}
    </FlexElement>
  );
};

export default memo(ChartDisplay);
