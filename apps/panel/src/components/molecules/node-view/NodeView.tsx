import React, {useCallback, memo} from "react";
import styles from "./NodeView.module.scss";
import {Button, Icon} from "oziko-ui-kit";
import {useNavigate} from "react-router-dom";
import DeleteBucket from "../../prefabs/delete-bucket/DeleteBucket";
import type {BucketType} from "../../../services/bucketService";
import EditBucket from "../../prefabs/edit-bucket/EditBucket";

export interface Field {
  id: string;
  name: string;
  type: string;
  isUnique?: boolean;
  isRelation?: boolean;
  relationTo?: string;
  path?: string;
}

export interface Node {
  id: string;
  name: string;
  position: {x: number; y: number};
  fields: Field[];
}

interface NodeViewProps {
  node: Node;
  bucket: BucketType;
  onMouseDown: (nodeId: string, e: React.MouseEvent) => void;
  onClick?: (nodeId: string, e: React.MouseEvent) => void;
  onAddField: (nodeId: string) => void;
  onRemoveField: (nodeId: string, fieldId: string) => void;
  dragging: boolean;
  isFocused?: boolean;
  focusMode?: boolean;
  isDirectlyFocused?: boolean;
}

const NodeView: React.FC<NodeViewProps> = ({
  node,
  bucket,
  onMouseDown,
  onClick,
  onAddField,
  onRemoveField,
  dragging,
  isFocused = true,
  focusMode = false,
  isDirectlyFocused = false
}) => {
  const mouseDownPosRef = React.useRef<{x: number; y: number} | null>(null);
  const navigate = useNavigate();
  const handleNodeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      mouseDownPosRef.current = {x: e.clientX, y: e.clientY};
      onMouseDown(node.id, e);
    },
    [node.id, onMouseDown]
  );

  const handleSettingsClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      navigate(`/bucket/${node.id}`);
    },
    [navigate, node.id]
  );

  const handleNodeClick = useCallback(
    (e: React.MouseEvent) => {
      if (!onClick || !mouseDownPosRef.current) return;

      const dx = Math.abs(e.clientX - mouseDownPosRef.current.x);
      const dy = Math.abs(e.clientY - mouseDownPosRef.current.y);

      if (dx < 5 && dy < 5) {
        onClick(node.id, e);
      }

      mouseDownPosRef.current = null;
    },
    [node.id, onClick]
  );

  const handleAddField = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onAddField(node.id);
    },
    [node.id, onAddField]
  );

  const handleRemoveField = useCallback(
    (fieldId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      onRemoveField(node.id, fieldId);
    },
    [node.id, onRemoveField]
  );

  const getFieldIcon = useCallback((type: string, isRelation?: boolean) => {
    if (isRelation) return "🔗";

    switch (type) {
      case "unique":
        return "🔑";
      case "string":
        return "📝";
      case "textarea":
        return "📝";
      case "number":
        return "🔢";
      case "boolean":
        return "☑️";
      case "object":
        return "📦";
      case "array":
        return "📋";
      case "multiselect":
        return "📋";
      case "relation":
        return "🔗";
      case "date":
        return "📅";
      case "color":
        return "🎨";
      case "storage":
        return "💾";
      case "location":
        return "📍";
      case "richtext":
        return "📄";
      default:
        return "•";
    }
  }, []);

  const getFieldTypeDisplay = useCallback((field: Field) => {
    if (field.isUnique) return "unique";
    if (field.isRelation) return "relation";
    return field.type;
  }, []);

  const getFieldIndent = useCallback((path?: string) => {
    if (!path) return 0;
    return (path.split(".").length - 1) * 15;
  }, []);

  const getFieldDisplayName = useCallback((field: Field) => {
    const path = field.path || field.name;
    const parts = path.split(".");
    return parts[parts.length - 1];
  }, []);

  return (
    <div
      className={`${styles.node} ${
        focusMode && !isFocused
          ? styles.unfocused
          : focusMode && isDirectlyFocused
            ? styles.focused
            : focusMode && isFocused
              ? styles.related
              : ""
      }`}
      style={{
        left: node.position.x,
        top: node.position.y,
        cursor: dragging ? "grabbing" : "grab"
      }}
      onMouseDown={handleNodeMouseDown}
      onMouseUp={handleNodeClick}
      onClick={e => e.stopPropagation()}
    >
      <div className={styles.nodeHeader}>
        <div className={styles.nodeTitle}>
          <h3>{node.name}</h3>
          <div className={styles.nodeControls}>
            <EditBucket bucket={bucket}>
              {({onOpen}) => (
                <Button variant="icon" className={styles.settingsButton} onClick={onOpen}>
                  <Icon name="cog" />
                </Button>
              )}
            </EditBucket>

            <DeleteBucket bucket={bucket}>
              {({onOpen}) => (
                <Button variant="icon" className={styles.deleteButton} onClick={onOpen}>
                  <Icon name="delete" />
                </Button>
              )}
            </DeleteBucket>
          </div>
        </div>
        <span className={styles.nodeId}>{node.id}</span>
      </div>

      <div className={styles.nodeFields}>
        {node.fields.map(field => (
          <div
            key={field.id}
            className={styles.fieldRow}
            data-field-path={field.path || field.name}
            data-node-id={node.id}
            style={{paddingLeft: `${getFieldIndent(field.path)}px`}}
          >
            <span className={styles.fieldIcon}>{getFieldIcon(field.type, field.isRelation)}</span>
            <span className={styles.fieldName}>{getFieldDisplayName(field)}</span>
            <span className={styles.fieldType}>{getFieldTypeDisplay(field)}</span>
            <div className={styles.fieldControls}>
              <button className={styles.controlBtn}>✏️</button>
              <button
                className={`${styles.controlBtn} ${styles.delete}`}
                onClick={e => handleRemoveField(field.id, e)}
              >
                🗑️
              </button>
            </div>
          </div>
        ))}

        <button className={styles.addFieldBtn} onClick={handleAddField}>
          + Add New Field
        </button>
      </div>
    </div>
  );
};

export default memo(NodeView);
