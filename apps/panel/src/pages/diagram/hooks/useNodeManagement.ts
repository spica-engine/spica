import { useRef, useEffect } from "react";
import type { Node } from "./useBucketConverter";

export const useNodeManagement = (
  nodes: Node[],
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>
) => {
  const fieldRefsMap = useRef<Map<string, DOMRect>>(new Map());

  useEffect(() => {
    const updateFieldPositions = () => {
      fieldRefsMap.current.clear();
      
      document.querySelectorAll(`.field-row`).forEach(el => {
        const fieldId = el.getAttribute('data-field-path');
        const nodeId = el.getAttribute('data-node-id');
        
        if (fieldId && nodeId) {
          const key = `${nodeId}-${fieldId}`;
          fieldRefsMap.current.set(key, el.getBoundingClientRect());
        }
      });
    };
    
    const timer = setTimeout(updateFieldPositions, 100);
    
    return () => clearTimeout(timer);
  }, [nodes]);

  const addField = (nodeId: string) => {
    const newFieldName = prompt("Enter field name:");
    const fieldType = prompt(
      "Enter field type (text, number, boolean, object, array, relation, unique):"
    );

    if (!newFieldName || !fieldType) return;

    setNodes(prev =>
      prev.map(node =>
        node.id === nodeId
          ? {
              ...node,
              fields: [
                ...node.fields,
                {
                  id: `${nodeId}_${newFieldName}`,
                  name: newFieldName,
                  type: fieldType,
                  path: newFieldName
                }
              ]
            }
          : node
      )
    );
  };

  const removeField = (nodeId: string, fieldId: string) => {
    setNodes(prev =>
      prev.map(node =>
        node.id === nodeId ? { ...node, fields: node.fields.filter(f => f.id !== fieldId) } : node
      )
    );
  };

  return {
    fieldRefsMap,
    addField,
    removeField
  };
};