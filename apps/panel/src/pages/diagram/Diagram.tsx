import React, { useState, useRef, useEffect } from "react";
import { useBucketService } from "../../services/bucketService";
import styles from "./Diagram.module.scss";
import ZoomControl from "../../components/molecules/zoom-control/ZoomControl";
import NodeView from "../../components/molecules/node-view/NodeView";
import {
  useBucketConverter,
  useDiagramInteractions,
  useFocusMode,
  useNodeManagement,
  useRelationRenderer
} from "./hooks";

const Diagram: React.FC = () => {
  const { apiGetBuckets, apiBuckets } = useBucketService();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { nodes, relations } = useBucketConverter(apiBuckets);
  const [currentNodes, setCurrentNodes] = useState(nodes);
  
  useEffect(() => {
    setCurrentNodes(nodes);
  }, [nodes]);
  
  const interactions = useDiagramInteractions(currentNodes, setCurrentNodes, containerRef);
  const focusMode = useFocusMode(relations);
  const nodeManagement = useNodeManagement(currentNodes, setCurrentNodes);
  const relationRenderer = useRelationRenderer(currentNodes);
  useEffect(() => {
    apiGetBuckets();
  }, [apiGetBuckets]);

  const renderRelationArrow = (relation: any, relationIndex: number) => {
    if (!focusMode.isRelationVisible(relation, relationIndex)) return null;

    const relationData = relationRenderer.renderRelationArrow(relation, relationIndex);
    if (!relationData) return null;

    const {
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
      useLeftSideEnd
    } = relationData;

    const isRelationFocused = focusMode.focusedNodeId && (
      relation.from === focusMode.focusedNodeId || 
      relation.to === focusMode.focusedNodeId ||
      focusMode.focusedRelatedNodes.has(relation.from) ||
      focusMode.focusedRelatedNodes.has(relation.to)
    );

    return (
      <g key={relationId} className={`${styles.relationLine} ${
        focusMode.focusedNodeId && !isRelationFocused 
          ? styles.unfocused 
          : isRelationFocused 
            ? styles.focused 
            : ''
      }`}>
        <path
          d={pathData}
          stroke="#666"
          strokeWidth="2"
          fill="none"
          markerEnd="url(#arrowhead)"
        />
        
        <circle
          cx={labelMidX}
          cy={labelMidY}
          r="20"
          fill="white"
          stroke="#ddd"
          strokeWidth="1"
        />
        <text
          x={labelMidX}
          y={labelMidY + 4}
          textAnchor="middle"
          fontSize="12"
          fill="#444"
          fontWeight="bold"
          className={styles.relationTypeLabel}
        >
          {relation.type}
        </text>
        
      </g>
    );
  };

  if (!apiBuckets || apiBuckets.length === 0) {
    return (
      <div className={styles.diagramContainer}>
        <div className={styles.loadingMessage}>Loading buckets...</div>
      </div>
    );
  }

  return (
    <div className={styles.diagramWrapper}>
      <ZoomControl
        zoom={interactions.zoom}
        zoomIn={interactions.zoomIn}
        zoomOut={interactions.zoomOut}
        fitToView={interactions.fitToView}
        resetView={interactions.resetView}
      />

      <div
        ref={containerRef}
        className={styles.diagramContainer}
        onMouseDown={(e) => {
          interactions.handlePanStart(e);
          focusMode.handleBackgroundClick(e, containerRef); // Add background click handler
        }}
        onMouseMove={interactions.handleMouseMove}
        onMouseUp={interactions.handleMouseUp}
        onWheel={interactions.handleWheel}
        style={{
          cursor: interactions.isPanning ? "grabbing" : interactions.dragging ? "grabbing" : "grab"
        }}
      >
        <div
          className={styles.diagramContent}
          style={{
            transform: `translate(${interactions.pan.x}px, ${interactions.pan.y}px) scale(${interactions.zoom})`,
            transformOrigin: "0 0"
          }}
        >
          <svg
            ref={svgRef}
            className={styles.relationsSvg}
            style={{
              width: "5000px",
              height: "5000px",
              position: "absolute",
              top: 0,
              left: 0,
              pointerEvents: "none"
            }}
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="12"
                markerHeight="8"
                refX="11"
                refY="4"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <polygon points="0 0, 12 4, 0 8" fill="#666" />
              </marker>
            </defs>
            {relations.map((relation, index) => renderRelationArrow(relation, index))}
          </svg>

          {currentNodes.map(node => (
            <NodeView
              key={node.id}
              node={node}
              onMouseDown={interactions.handleMouseDown}
              onClick={focusMode.handleNodeClick}
              onAddField={nodeManagement.addField}
              onRemoveField={nodeManagement.removeField}
              dragging={interactions.dragging === node.id}
              isFocused={focusMode.isNodeFocused(node.id)}
              focusMode={focusMode.focusedNodeId !== null}
              isDirectlyFocused={node.id === focusMode.focusedNodeId}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Diagram;
