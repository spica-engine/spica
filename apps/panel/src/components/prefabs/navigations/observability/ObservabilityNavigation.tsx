import {FlexElement, FluidContainer, Icon, Text} from "oziko-ui-kit";
import styles from "../Navigation.module.scss";
import React from "react";
import {useNavigate} from "react-router-dom";
import type {IconName} from "oziko-ui-kit";

type ObservabilityItem = {
  title: string;
  icon: IconName;
  onClick: () => void;
};

const ObservabilityNavigation = () => {
  const navigate = useNavigate();

  const items: ObservabilityItem[] = [
    {
      title: "User",
      icon: "person",
      onClick: () => {
        navigate("/passport/user/profile");
      }
    },
    {
      title: "Bucket",
      icon: "bucket",
      onClick: () => {
        navigate("/passport/observability/bucket");
      }
    }
  ];

  return (
    <div className={styles.container}>
      <FluidContainer
        dimensionX="fill"
        mode="fill"
        className={styles.header}
        root={{
          children: (
            <Text dimensionX="fill" size="large">
              Observability
            </Text>
          )
        }}
      />

      <FlexElement direction="vertical" dimensionX="fill">
        {items.map(item => (
          <FluidContainer
            key={item.title}
            dimensionX="fill"
            dimensionY={36}
            mode="fill"
            alignment="leftCenter"
            className={styles.defaultNavigationItem}
            onClick={item.onClick}
            prefix={{
              children: <Icon name={item.icon} />
            }}
            root={{
              children: (
                <Text dimensionX="fill" size="medium">
                  {item.title}
                </Text>
              )
            }}
          />
        ))}
      </FlexElement>
    </div>
  );
};

export default ObservabilityNavigation;
