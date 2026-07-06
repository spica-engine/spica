import {memo} from "react";
import {Icon} from "oziko-ui-kit";
import type {Node as RFNode, NodeProps} from "@xyflow/react";
import styles from "./DiagramRingLabel.module.scss";

export type DiagramRingLabelData = {
  text: string;
};

export type DiagramRingLabelFlowNode = RFNode<DiagramRingLabelData, "ringLabel">;

const DiagramRingLabel = ({data}: NodeProps<DiagramRingLabelFlowNode>) => (
  <div className={styles.diagramRingLabel}>
    <Icon name="layers" size="sm" />
    <span className={styles.text}>{data.text}</span>
  </div>
);

export default memo(DiagramRingLabel);
