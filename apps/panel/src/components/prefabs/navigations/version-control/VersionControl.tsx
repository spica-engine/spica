import React from "react";
import styles from "../Navigation.module.scss";
import vcStyles from "./VersionControl.module.scss";
import {FluidContainer, Text} from "oziko-ui-kit";
import type {NavigationPrefabProps} from "../navigation-registry";
import {useVersionControlDiff} from "../../../../hooks/useVersionControlDiff";
import type {ChangeStatus} from "../../../../types/version-control";

const BADGE_CLASS: Record<ChangeStatus, string> = {
  A: vcStyles.badgeAdded,
  M: vcStyles.badgeModified,
  D: vcStyles.badgeDeleted,
};

const VersionControlNavigation: React.FC<NavigationPrefabProps> = () => {
  const {modules, isLoading, error} = useVersionControlDiff();

  return (
    <div className={styles.container}>
      <FluidContainer
        dimensionX={"fill"}
        mode={"fill"}
        className={styles.header}
        root={{
          children: (
            <Text dimensionX={"fill"} size="large">
              Changes
            </Text>
          )
        }}
      />

      <div className={vcStyles.changesBody}>
        {isLoading && (
          <div className={vcStyles.statusMessage}>Loading changes...</div>
        )}

        {!isLoading && error && (
          <div className={vcStyles.errorMessage}>Failed to load changes.</div>
        )}

        {!isLoading && !error && modules.length === 0 && (
          <div className={vcStyles.emptyMessage}>No changes detected.</div>
        )}

        {!isLoading && !error && modules.map(group => (
          <div key={group.moduleType} className={vcStyles.moduleSection}>
            <div className={vcStyles.moduleSectionHeader}>{group.moduleType}</div>
            {group.items.map(item => (
              <div key={item.id} className={vcStyles.changeItem}>
                <span className={vcStyles.changeItemLabel}>{item.label}</span>
                <span className={`${vcStyles.badge} ${BADGE_CLASS[item.status]}`}>
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default VersionControlNavigation;
