import {memo} from "react";
import {Handle, Position, type NodeProps, type Node as RFNode} from "@xyflow/react";
import {Icon, type IconName} from "oziko-ui-kit";
import styles from "./BucketDiagramNode.module.scss";

export type NodeFocusVariant = "focused" | "related" | "unfocused";

export type BucketDiagramNodeData = {
  bucketId: string;
  title: string;
  icon: IconName;
  size: number;
  fieldCount: number;
  relationCount: number;
  isIsolated: boolean;
  focus?: NodeFocusVariant;
  selected?: boolean;
};

export type BucketDiagramFlowNode = RFNode<BucketDiagramNodeData, "bucketNode">;

const focusClassMap: Record<NodeFocusVariant, string> = {
  focused: styles.focused,
  related: styles.related,
  unfocused: styles.unfocused
};

const BucketDiagramNode = ({data}: NodeProps<BucketDiagramFlowNode>) => {
  const {title, icon, size, fieldCount, relationCount, isIsolated, focus, selected} = data;

  const classNames = [
    styles.bucketDiagramNode,
    isIsolated ? styles.isolated : "",
    selected ? styles.selected : "",
    focus ? focusClassMap[focus] : ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classNames} style={{width: size, height: size}}>
      <Handle type="target" position={Position.Left} className={styles.handle} />
      <Handle type="source" position={Position.Right} className={styles.handle} />

      <Icon name={icon} className={styles.icon} />
      <span className={styles.title} title={title}>
        {title}
      </span>
      <div className={styles.meta}>
        <span className={styles.metaItem}>
          <Icon name="fields" size="xs" />
          {fieldCount}
        </span>
        <span className={styles.metaItem}>
          <Icon name="accountTree" size="xs" />
          {relationCount}
        </span>
      </div>
    </div>
  );
};

export default memo(BucketDiagramNode);
