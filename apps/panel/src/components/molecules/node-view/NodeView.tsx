import React, { useCallback, memo } from 'react';
import styles from './NodeView.module.scss';

export interface Field {
  id: string;
  name: string;
  type: string;
  isUnique?: boolean;
  isRelation?: boolean;
  relationTo?: string;
  path?: string; // Add path property
}

export interface Node {
  id: string;
  name: string;
  position: { x: number; y: number };
  fields: Field[];
}

interface NodeViewProps {
  node: Node;
  onMouseDown: (nodeId: string, e: React.MouseEvent) => void;
  onAddField: (nodeId: string) => void;
  onRemoveField: (nodeId: string, fieldId: string) => void;
  dragging: boolean;
}

const NodeView: React.FC<NodeViewProps> = ({
  node,
  onMouseDown,
  onAddField,
  onRemoveField,
  dragging,
}) => {
  // Use callbacks to prevent unnecessary re-renders
  const handleNodeMouseDown = useCallback((e: React.MouseEvent) => {
    onMouseDown(node.id, e);
  }, [node.id, onMouseDown]);

  const handleAddField = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onAddField(node.id);
  }, [node.id, onAddField]);

  const handleRemoveField = useCallback((fieldId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onRemoveField(node.id, fieldId);
  }, [node.id, onRemoveField]);

  const getFieldIcon = useCallback((type: string, isRelation?: boolean) => {
    if (isRelation) return '🔗';
    
    switch (type) {
      case 'unique': return '🔑';
      case 'string': return '📝';
      case 'textarea': return '📝';
      case 'number': return '🔢';
      case 'boolean': return '☑️';
      case 'object': return '📦';
      case 'array': return '📋';
      case 'multiselect': return '📋';
      case 'relation': return '🔗';
      case 'date': return '📅';
      case 'color': return '🎨';
      case 'storage': return '💾';
      case 'location': return '📍';
      case 'richtext': return '📄';
      default: return '•';
    }
  }, []);

  const getFieldTypeDisplay = useCallback((field: Field) => {
    if (field.isUnique) return 'unique';
    if (field.isRelation) return 'relation';
    return field.type;
  }, []);

  // Helper to create indentation for nested fields
  const getFieldIndent = useCallback((path?: string) => {
    if (!path) return 0;
    return (path.split('.').length - 1) * 15; // 15px indent per level
  }, []);

  // Helper to format field name for display - show only the last part of nested fields
  const getFieldDisplayName = useCallback((field: Field) => {
    const path = field.path || field.name;
    const parts = path.split('.');
    return parts[parts.length - 1];
  }, []);

  return (
    <div
      className={styles.node}
      style={{
        left: node.position.x,
        top: node.position.y,
        cursor: dragging ? 'grabbing' : 'grab'
      }}
      onMouseDown={handleNodeMouseDown}
    >
      <div className={styles.nodeHeader}>
        <h3>{node.name}</h3>
        <span className={styles.nodeId}>{node.id.substring(0, 12)}...</span>
        <div className={styles.nodeControls}>
          <button className={styles.controlBtn}>⚙️</button>
          <button className={`${styles.controlBtn} ${styles.delete}`}>🗑️</button>
        </div>
      </div>

      <div className={styles.nodeFields}>
        {node.fields.map(field => (
          <div 
            key={field.id}
            className={styles.fieldRow}
            data-field-path={field.path || field.name}
            data-node-id={node.id}
            style={{ paddingLeft: `${getFieldIndent(field.path)}px` }}
          >
            <span className={styles.fieldIcon}>{getFieldIcon(field.type, field.isRelation)}</span>
            <span className={styles.fieldName}>{getFieldDisplayName(field)}</span>
            <span className={styles.fieldType}>{getFieldTypeDisplay(field)}</span>
            <div className={styles.fieldControls}>
              <button className={styles.controlBtn}>✏️</button>
              <button 
                className={`${styles.controlBtn} ${styles.delete}`}
                onClick={(e) => handleRemoveField(field.id, e)}
              >
                🗑️
              </button>
            </div>
          </div>
        ))}
        
        <button 
          className={styles.addFieldBtn}
          onClick={handleAddField}
        >
          + Add New Field
        </button>
      </div>
    </div>
  );
};

// Use memo to prevent unnecessary re-renders
export default memo(NodeView);