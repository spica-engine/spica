import {Icon, type IconName} from "oziko-ui-kit";
import styles from "../Navigation.module.scss";
import bucketNavigationStyles from "../bucket-navigation/Bucket.module.scss";
import React from "react";
import {useNavigate, useLocation} from "react-router-dom";

type ObservabilityItem = {
  title: string;
  icon: IconName;
  path: string;
};

const ObservabilityNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const items: ObservabilityItem[] = [
    {
      title: "User",
      icon: "person",
      path: "/passport/observability/user"
    },
    {
      title: "Bucket",
      icon: "bucket",
      path: "/passport/observability/bucket"
    }
  ];

  return (
    <div className={styles.container}>
      <div className={styles.sidebarHead}>
        <div className={styles.sidebarTopRow}>
          <span className={styles.sidebarLabel}>Observability</span>
        </div>
      </div>

      <div className={bucketNavigationStyles.bucketsItemContainer}>
        {items.map(item => {
          const isActive = location.pathname.startsWith(item.path);
          return (
            <div
              key={item.title}
              className={`${bucketNavigationStyles.bucketItem}${isActive ? ` ${bucketNavigationStyles.bucketItemActive}` : ""}`}
              onClick={() => navigate(item.path)}
            >
              <Icon
                name={item.icon}
                size="sm"
                style={{flexShrink: 0, opacity: isActive ? 1 : 0.6} as React.CSSProperties}
              />
              <span className={bucketNavigationStyles.bucketTitle}>{item.title}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ObservabilityNavigation;
