/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import {Icon, type IconName} from "oziko-ui-kit";
import styles from "../Navigation.module.scss";
import bucketNavigationStyles from "../bucket-navigation/Bucket.module.scss";
import React from "react";
import {useNavigate, useLocation} from "react-router-dom";
import strategyIcon from "../../../../assets/icons/strategy.svg";
import accountDetails from "../../../../assets/icons/account-details.svg";

type AccessManagementItem = {
  title: string;
  icon: IconName | React.ReactElement;
  path: string;
  onClick: () => void;
};

const AccessManagement = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const accessManagementItems: AccessManagementItem[] = [
    {
      title: "Identities",
      icon: "identities",
      path: "/passport/identity",
      onClick: () => navigate("/passport/identity")
    },
    {
      title: "Users",
      icon: "person",
      path: "/passport/user",
      onClick: () => navigate("/passport/user")
    },
    {
      title: "Policies",
      icon: "layers",
      path: "/passport/policy",
      onClick: () => navigate("passport/policy")
    },
    {
      title: "Strategies",
      icon: <img src={strategyIcon} alt="strategy" className={styles.icon} />,
      path: "/passport/strategy",
      onClick: () => navigate("/passport/strategy")
    },
    {
      title: "API Keys",
      icon: "key",
      path: "/passport/api-key",
      onClick: () => navigate("/passport/api-key")
    },
    {
      title: "Refresh Tokens",
      icon: "key",
      path: "/passport/refresh-token",
      onClick: () => navigate("/passport/refresh-token")
    },
    {
      title: "Secrets and Variables",
      icon: "lock" as IconName,
      path: "/passport/secrets-and-variables",
      onClick: () => navigate("/passport/secrets-and-variables")
    },
    {
      title: "User Activities",
      icon: <img src={accountDetails} alt="activity" className={styles.icon} />,
      path: "/activity",
      onClick: () => navigate("/activity")
    }
  ];

  return (
    <div className={styles.container}>
      <div className={styles.sidebarHead}>
        <div className={styles.sidebarTopRow}>
          <span className={styles.sidebarLabel}>Access Management</span>
        </div>
      </div>

      <div className={bucketNavigationStyles.bucketsItemContainer}>
        {accessManagementItems.map(item => {
          const isActive = location.pathname.startsWith(item.path);
          return (
            <div
              key={item.title}
              className={`${bucketNavigationStyles.bucketItem}${isActive ? ` ${bucketNavigationStyles.bucketItemActive}` : ""}`}
              onClick={item.onClick}
            >
              {typeof item.icon === "string" ? (
                <Icon
                  name={item.icon}
                  size="sm"
                  style={{flexShrink: 0, opacity: isActive ? 1 : 0.6} as React.CSSProperties}
                />
              ) : (
                item.icon
              )}
              <span className={bucketNavigationStyles.bucketTitle}>{item.title}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AccessManagement;
