/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import {FlexElement, FluidContainer, Icon, Text, type IconName} from "oziko-ui-kit";
import styles from "../Navigation.module.scss";
import React from "react";
import {useNavigate} from "react-router-dom";
import strategyIcon from "../../../../assets/icons/strategy.svg";
import accountDetails from "../../../../assets/icons/account-details.svg";



type AccessManagementItem = {
  title: string;
  icon: IconName | React.ReactElement;
  onClick: () => void;
};

const AccessManagement = () => {
  const navigate = useNavigate();

  const accessManagementItems: AccessManagementItem[] = [
    {
      title: "Identities",
      icon: "identities",
      onClick: () => {
        navigate("/passport/identity");
      }
    },
    {
      title: "Policies",
      icon: "layers",
      onClick: () => {
        navigate("passport/policy");
      }
    },
    {
      title: "Strategies",
      icon: <img src={strategyIcon} alt="strategy" className={styles.icon}/>,
      onClick: () => {
        navigate("/passport/strategy");
      }
    },
    {
      title: "API Keys",
      icon: "key",
      onClick: () => {
        navigate("/passport/api-key");
      }
    },
    {
      title: "User Activities",
      icon: <img src={accountDetails} alt="activity" className={styles.icon}/>,
      onClick: () => {
        navigate("/activity");
      }
    }
  ];

  return (
    <div className={styles.container}>
      <FluidContainer
        dimensionX={"fill"}
        mode="fill"
        className={styles.header}
        root={{
          children: (
            <Text dimensionX={"fill"} size="large">
              Access Management
            </Text>
          )
        }}
      />

      <FlexElement direction="vertical" dimensionX="fill" >
        {accessManagementItems.map(item => (
          <FluidContainer
            key={item.title}
            dimensionX="fill"
            dimensionY={36}
            mode="fill"
            alignment="leftCenter"
            className={styles.defaultNavigationItem}
            onClick={item.onClick}

            prefix={{
                children: typeof item.icon === "string" ? <Icon name={item.icon} /> : item.icon
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

export default AccessManagement;
