import { useCallback } from "react";
import type { Node, Relation } from "./useBucketConverter";

export const useRelationRenderer = (nodes: Node[]) => {
  const renderRelationArrow = useCallback((relation: Relation, relationIndex: number) => {
    const fromNode = nodes.find(n => n.id === relation.from);
    const toNode = nodes.find(n => n.id === relation.to);

    if (!fromNode || !toNode) return null;

    const nodeWidth = 350;
    const fieldHeight = 30;
    const headerHeight = 50;
    const spacing = 5;
    
    const fromFieldPath = relation.fromPath || relation.fromField;
    const fromField = fromNode.fields.find(f => f.path === fromFieldPath);
    
    if (!fromField) return null;
    
    const fromFieldIndex = fromNode.fields.findIndex(f => f.path === fromFieldPath);
    
    const fromNodeCenterX = fromNode.position.x + nodeWidth / 2;
    const toNodeCenterX = toNode.position.x + nodeWidth / 2;
    
    const useRightSideStart = toNodeCenterX > fromNodeCenterX;
    
    const useLeftSideEnd = fromNodeCenterX < toNodeCenterX;
    
    const startX = useRightSideStart 
      ? fromNode.position.x + nodeWidth - spacing
      : fromNode.position.x + spacing;
    const startY = fromNode.position.y + headerHeight + (fromFieldIndex * fieldHeight) + (fieldHeight / 2);
    
    const endX = useLeftSideEnd 
      ? toNode.position.x + spacing
      : toNode.position.x + nodeWidth - spacing;
    const endY = toNode.position.y + headerHeight;
    
    const deltaX = endX - startX;
    const deltaY = endY - startY;
    
    const midX = startX + deltaX / 2;
    const midY = startY + deltaY / 2;
    
    const cornerRadius = Math.min(30, Math.abs(deltaX) / 4, Math.abs(deltaY) / 4);
    
    let pathData: string;
    const turnPointX = midX;
    const beforeTurnX = turnPointX - Math.sign(deltaX) * cornerRadius;
    const afterTurnX = turnPointX + Math.sign(deltaX) * cornerRadius;
    const beforeTurnY = startY;
    const afterTurnY = endY;
    
    if (Math.abs(deltaY) < cornerRadius * 2) {
      pathData = `M ${startX} ${startY} L ${midX - Math.sign(deltaX) * cornerRadius} ${startY} Q ${midX} ${startY} ${midX} ${startY + Math.sign(deltaY) * cornerRadius} L ${midX} ${endY - Math.sign(deltaY) * cornerRadius} Q ${midX} ${endY} ${midX + Math.sign(deltaX) * cornerRadius} ${endY} L ${endX} ${endY}`;
    } else {
      pathData = `M ${startX} ${startY} L ${beforeTurnX} ${startY} Q ${turnPointX} ${startY} ${turnPointX} ${startY + Math.sign(deltaY) * cornerRadius} L ${turnPointX} ${afterTurnY - Math.sign(deltaY) * cornerRadius} Q ${turnPointX} ${afterTurnY} ${afterTurnX} ${afterTurnY} L ${endX} ${endY}`;
    }
    
    const [startType, endType] = relation.type.split(":");
    
    const relationId = `${relation.from}-${fromFieldPath}-${relation.to}`;

    const labelMidX = startX + (endX - startX) / 2;
    const labelMidY = startY + (endY - startY) / 2;

    return {
      relationId,
      pathData,
      startType,
      endType,
      labelMidX,
      labelMidY,
      startX,
      startY,
      endX,
      endY,
      useRightSideStart,
      useLeftSideEnd,
      relation
    };
  }, [nodes]);

  return {
    renderRelationArrow
  };
};