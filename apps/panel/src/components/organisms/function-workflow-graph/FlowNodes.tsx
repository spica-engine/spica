import React, {memo} from "react";
import {Handle, Position, type NodeProps} from "@xyflow/react";
import {Icon, type IconName} from "oziko-ui-kit";
import type {FunctionHubData, DataSatelliteData, NodeFocus} from "./graphModel";
import styles from "./FunctionWorkflowGraph.module.scss";

const focusClass = (focus: NodeFocus | undefined): string => {
  if (focus === "focused") return styles.focused;
  if (focus === "related") return styles.related;
  if (focus === "dimmed") return styles.dimmed;
  return "";
};

const sizeClass = (connectionCount: number): string => {
  if (connectionCount >= 3) return styles.sizeLg;
  if (connectionCount >= 1) return styles.sizeMd;
  return styles.sizeSm;
};

export const FunctionHubNode = memo(({data}: NodeProps) => {
  const hub = data as FunctionHubData;
  return (
    <div className={`${styles.functionHub} ${sizeClass(hub.connectionCount)} ${focusClass(hub.focus)}`}>
      <Handle type="target" id="targetLeft" position={Position.Left} className={styles.hubHandle} />
      <Handle type="target" id="targetRight" position={Position.Right} className={styles.hubHandle} />

      <div className={styles.hubCore}>
        <Icon name="function" size="sm" className={styles.hubIcon} />
        <span className={styles.hubHandler}>{hub.handler}</span>
      </div>
      <span className={styles.hubName}>{hub.name}</span>

      <div className={styles.hubBadges}>
        {hub.connectionCount > 0 && (
          <span className={`${styles.hubBadge} ${styles.badgeData}`}>{hub.connectionCount} data</span>
        )}
      </div>
    </div>
  );
});

FunctionHubNode.displayName = "FunctionHubNode";

export const DataSatelliteNode = memo(({data}: NodeProps) => {
  const satellite = data as DataSatelliteData;
  const icon: IconName = satellite.kind === "bucket" ? "bucket" : "storage";
  return (
    <div className={`${styles.dataSatellite} ${styles[satellite.kind]} ${focusClass(satellite.focus)}`}>
      <Handle type="source" id="sourceLeft" position={Position.Left} className={styles.satelliteHandle} />
      <Handle type="source" id="sourceRight" position={Position.Right} className={styles.satelliteHandle} />

      <Icon name={icon} size="sm" className={styles.satelliteIcon} />
      <div className={styles.satelliteBody}>
        <span className={styles.satelliteLabel}>{satellite.label}</span>
        <span className={styles.satellitePhase}>
          {satellite.connectionCount} function{satellite.connectionCount === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
});

DataSatelliteNode.displayName = "DataSatelliteNode";
