import React, {memo, useCallback, useEffect, useMemo, useState} from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type ColorMode,
  type Node,
  type Edge,
  type NodeMouseHandler
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type {SpicaFunction} from "../../../store/api/functionApi";
import type {BucketType} from "../../../store/api/bucketApi";
import {
  buildWorkflowModel,
  type NodeFocus,
  type FunctionHubData,
  type DataSatelliteData,
  type WorkflowEdgeData
} from "./graphModel";
import {FunctionHubNode, DataSatelliteNode} from "./FlowNodes";
import styles from "./FunctionWorkflowGraph.module.scss";

type FunctionWorkflowGraphProps = {
  functions: SpicaFunction[];
  buckets: BucketType[];
  colorMode: ColorMode;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
};

const nodeTypes = {
  functionHub: FunctionHubNode,
  dataSatellite: DataSatelliteNode
};

const focusFor = (
  isMember: boolean,
  isPrimary: boolean,
  hasFocus: boolean
): NodeFocus | undefined => {
  if (!hasFocus) return undefined;
  if (isPrimary) return "focused";
  return isMember ? "related" : "dimmed";
};

const FunctionWorkflowGraph = ({
  functions,
  buckets,
  colorMode,
  isLoading,
  isError,
  onRetry
}: FunctionWorkflowGraphProps) => {
  const model = useMemo(() => buildWorkflowModel(functions, buckets), [functions, buckets]);

  const [focusedFunctionId, setFocusedFunctionId] = useState<string | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(model.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(model.edges);

  useEffect(() => {
    setNodes(model.nodes);
    setEdges(model.edges);
    setFocusedFunctionId(null);
  }, [model, setNodes, setEdges]);

  const memberNodeIds = useMemo(() => {
    if (!focusedFunctionId) return null;
    return new Set(model.adjacency[focusedFunctionId]?.nodeIds ?? []);
  }, [focusedFunctionId, model]);

  const styledNodes = useMemo<Node[]>(() => {
    const hasFocus = focusedFunctionId !== null;
    return nodes.map(node => {
      if (node.type === "functionHub") {
        const hubData = node.data as FunctionHubData;
        const focus = focusFor(
          hubData.functionId === focusedFunctionId,
          hubData.functionId === focusedFunctionId,
          hasFocus
        );
        return {...node, data: {...hubData, focus}};
      }
      const satelliteData = node.data as DataSatelliteData;
      const isMember = memberNodeIds?.has(node.id) ?? false;
      const focus = focusFor(isMember, false, hasFocus);
      return {...node, data: {...satelliteData, focus}};
    });
  }, [nodes, focusedFunctionId, memberNodeIds]);

  const styledEdges = useMemo<Edge[]>(() => {
    if (!focusedFunctionId) {
      return edges.map(edge => ({...edge, hidden: false, className: undefined}));
    }
    return edges.map(edge => {
      const owner = (edge.data as WorkflowEdgeData | undefined)?.functionId;
      const active = owner === focusedFunctionId;
      // Connected edges switch to the highlight colour; the rest stay visible but
      // fade to idle so the active connections clearly stand out.
      return {...edge, hidden: false, className: active ? styles.edgeFocused : styles.edgeDimmed};
    });
  }, [edges, focusedFunctionId]);

  const handleNodeClick = useCallback<NodeMouseHandler>((_event, node) => {
    let owner: string | null = null;
    if (node.type === "functionHub") {
      owner = (node.data as FunctionHubData).functionId ?? null;
    } else if (node.type === "dataSatellite") {
      const satellite = node.data as DataSatelliteData;
      // A shared data node belongs to several functions, so focusing a single one
      // is ambiguous — only solo data nodes drive focus.
      owner = satellite.functionIds.length === 1 ? satellite.functionIds[0] : null;
    }
    if (!owner) return;
    setFocusedFunctionId(prev => (prev === owner ? null : owner));
  }, []);

  const handlePaneClick = useCallback(() => setFocusedFunctionId(null), []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFocusedFunctionId(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (isLoading) {
    return (
      <div className={styles.graphState}>
        <div className={styles.skeletonConstellation}>
          <span className={`${styles.skeletonHub} ${styles.skeletonHubA}`} />
          <span className={`${styles.skeletonHub} ${styles.skeletonHubB}`} />
          <span className={`${styles.skeletonSatellite} ${styles.skeletonSatelliteA}`} />
          <span className={`${styles.skeletonSatellite} ${styles.skeletonSatelliteB}`} />
          <span className={styles.skeletonGroup} />
        </div>
        <span className={styles.stateText}>Mapping the workflow constellation…</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.graphState}>
        <span className={styles.stateTitle}>Couldn't load the workflow</span>
        <span className={styles.stateText}>The functions or buckets request failed.</span>
        {onRetry && (
          <button type="button" className={styles.retryButton} onClick={onRetry}>
            Retry
          </button>
        )}
      </div>
    );
  }

  if (functions.length === 0) {
    return (
      <div className={styles.graphState}>
        <span className={styles.stateTitle}>No functions yet</span>
        <span className={styles.stateText}>Create a function to see its workflow constellation.</span>
      </div>
    );
  }

  if (model.nodes.length === 0) {
    return (
      <div className={styles.graphState}>
        <span className={styles.stateTitle}>No connected triggers</span>
        <span className={styles.stateText}>
          None of your functions have a bucket or database trigger to map yet.
        </span>
      </div>
    );
  }

  return (
    <div className={styles.functionWorkflowGraph}>
      <ReactFlow
        nodes={styledNodes}
        edges={styledEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        colorMode={colorMode}
        minZoom={0.1}
        maxZoom={2.5}
        fitView
        proOptions={{hideAttribution: true}}
      >
        <Background />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  );
};

export default memo(FunctionWorkflowGraph);
