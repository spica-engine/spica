import {Icon} from "oziko-ui-kit";
import styles from "../Navigation.module.scss";
import configStyles from "./Config.module.scss";
import React from "react";
import {useNavigate, useParams} from "react-router-dom";
import {useGetConfigSchemasQuery} from "../../../../store/api/configApi";

const ConfigNavigation = () => {
  const navigate = useNavigate();
  const {module: activeModule} = useParams<{module: string}>();
  const {data: schemas} = useGetConfigSchemasQuery();

  const items = schemas
    ? Object.keys(schemas).map(key => ({module: key, label: key}))
    : [];

  return (
    <div className={styles.container}>
      <div className={styles.sidebarHead}>
        <div className={styles.sidebarTopRow}>
          <span className={styles.sidebarLabel}>Configuration</span>
        </div>
      </div>

      <div className={configStyles.itemsContainer}>
        {items.map(item => (
          <div
            key={item.module}
            className={`${configStyles.configItem}${activeModule === item.module ? ` ${configStyles.configItemActive}` : ""}`}
            onClick={() => navigate(`/config/${item.module}`)}
          >
            <Icon
              name="cog"
              size="sm"
              style={{flexShrink: 0, opacity: activeModule === item.module ? 1 : 0.6} as React.CSSProperties}
            />
            <span className={configStyles.configItemTitle}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ConfigNavigation;
