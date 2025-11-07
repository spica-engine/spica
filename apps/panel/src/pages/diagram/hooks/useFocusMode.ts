import { useState, useCallback, useEffect } from "react";
import type { Relation } from "./useBucketConverter";

export const useFocusMode = (relations: Relation[]) => {
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [focusedRelatedNodes, setFocusedRelatedNodes] = useState<Set<string>>(new Set());

  const isPopoverOpen = () => {
    const portals = document.querySelectorAll('[class*="Portal-module_container"]');
    return Array.from(portals).some(portal => {
      const style = window.getComputedStyle(portal as HTMLElement);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    });
  };

  const isNodeFocused = useCallback((nodeId: string) => {
    if (!focusedNodeId) return true;
    return nodeId === focusedNodeId || focusedRelatedNodes.has(nodeId);
  }, [focusedNodeId, focusedRelatedNodes]);
  
  const isRelationVisible = useCallback((relation: Relation, relationIndex: number) => {
    if (focusedNodeId) {
      return (
        (relation.from === focusedNodeId || focusedRelatedNodes.has(relation.from)) &&
        (relation.to === focusedNodeId || focusedRelatedNodes.has(relation.to))
      );
    }
    
    const firstRelationIndex = relations.findIndex(r => 
      (r.from === relation.from && r.to === relation.to) ||
      (r.from === relation.to && r.to === relation.from)
    );
    
    return relationIndex === firstRelationIndex;
  }, [focusedNodeId, focusedRelatedNodes, relations]);

  const handleNodeClick = useCallback((nodeId: string) => {
    if (isPopoverOpen()) {
      return;
    }

    if (focusedNodeId === nodeId) {
      setFocusedNodeId(null);
      setFocusedRelatedNodes(new Set());
    } else {
      const relatedNodeIds = new Set<string>();
      relations.forEach(relation => {
        if (relation.from === nodeId) {
          relatedNodeIds.add(relation.to);
        } else if (relation.to === nodeId) {
          relatedNodeIds.add(relation.from);
        }
      });
      
      setFocusedNodeId(nodeId);
      setFocusedRelatedNodes(relatedNodeIds);
    }
  }, [focusedNodeId, relations]);

  const handleBackgroundClick = useCallback((e: React.MouseEvent, containerRef: React.RefObject<HTMLDivElement | null>) => {
    if (isPopoverOpen()) {
      return;
    }

    if (
      focusedNodeId && 
      (e.target === containerRef.current ||
      (e.target as HTMLElement).closest(".diagram-content"))
    ) {
      setFocusedNodeId(null);
      setFocusedRelatedNodes(new Set());
    }
  }, [focusedNodeId]);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && focusedNodeId) {
        setFocusedNodeId(null);
        setFocusedRelatedNodes(new Set());
      }
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focusedNodeId]);

  return {
    focusedNodeId,
    focusedRelatedNodes,
    isNodeFocused,
    isRelationVisible,
    handleNodeClick,
    handleBackgroundClick
  };
};