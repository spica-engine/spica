import {useEffect, useMemo, useCallback, useState} from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  useNodesState,
  useEdgesState,
  type Edge,
  type NodeMouseHandler
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {Button, Icon, type IconName} from "oziko-ui-kit";
import {useGetBucketsQuery} from "../../store/api/bucketApi";
import styles from "./Diagram.module.scss";
import BucketDiagramNode, {
  type BucketDiagramNodeData,
  type BucketDiagramFlowNode,
  type NodeFocusVariant
} from "../../components/organisms/bucket-diagram-node/BucketDiagramNode";
import BucketDiagramInspector from "../../components/organisms/bucket-diagram-inspector/BucketDiagramInspector";
import DiagramRingLabel, {
  type DiagramRingLabelFlowNode
} from "../../components/molecules/diagram-ring-label/DiagramRingLabel";
import EditBucket from "../../components/prefabs/edit-bucket/EditBucket";
import {useBucketConverter} from "./hooks";
import {useDiagramColorMode} from "./hooks/useDiagramColorMode";
import {computeConstellationLayout} from "./layout/constellation";

const nodeTypes = {bucketNode: BucketDiagramNode, ringLabel: DiagramRingLabel};

const RING_LABEL_ID = "__ring-label__";
const EDGE_BASE_WIDTH = 1.5;
const EDGE_FOCUS_WIDTH = 4;

type DiagramFlowNode = BucketDiagramFlowNode | DiagramRingLabelFlowNode;

export default function Diagram() {
  const {data: buckets = [], isLoading, isError, refetch} = useGetBucketsQuery();
  const colorMode = useDiagramColorMode();

  const {nodes: diagramNodes, relations} = useBucketConverter(buckets || null);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const bucketById = useMemo(() => {
    const map = new Map<string, (typeof buckets)[number]>();
    buckets.forEach(bucket => map.set(bucket._id, bucket));
    return map;
  }, [buckets]);

  const fieldsById = useMemo(() => {
    const map = new Map<string, (typeof diagramNodes)[number]["fields"]>();
    diagramNodes.forEach(node => map.set(node.id, node.fields));
    return map;
  }, [diagramNodes]);

  const layout = useMemo(() => {
    const inputNodes = diagramNodes
      .filter(node => bucketById.has(node.id))
      .map(node => ({id: node.id, fieldCount: node.fields.length}));
    return computeConstellationLayout(inputNodes, relations);
  }, [diagramNodes, relations, bucketById]);

  const initialNodes = useMemo<DiagramFlowNode[]>(() => {
    const nodes: DiagramFlowNode[] = layout.nodes.map(placed => {
      const bucket = bucketById.get(placed.id)!;
      const fields = fieldsById.get(placed.id) ?? [];
      return {
        id: placed.id,
        type: "bucketNode",
        position: {x: placed.position.x - placed.size / 2, y: placed.position.y - placed.size / 2},
        data: {
          bucketId: placed.id,
          title: bucket.title,
          icon: (bucket.icon || "bucket") as IconName,
          size: placed.size,
          fieldCount: fields.length,
          relationCount: placed.relationCount,
          isIsolated: placed.isIsolated
        } satisfies BucketDiagramNodeData
      } satisfies BucketDiagramFlowNode;
    });

    if (layout.isolatedLabel) {
      nodes.push({
        id: RING_LABEL_ID,
        type: "ringLabel",
        position: layout.isolatedLabel.position,
        draggable: false,
        selectable: false,
        data: {text: "Unconnected buckets"}
      } satisfies DiagramRingLabelFlowNode);
    }

    return nodes;
  }, [layout, bucketById, fieldsById]);

  // Collapse relations to one edge per unordered bucket pair; the pair's relation count
  // drives the stroke width so heavily linked buckets read as thicker constellation lines.
  const initialEdges = useMemo<Edge[]>(() => {
    const counts = new Map<string, number>();
    const order: string[] = [];

    relations.forEach(relation => {
      if (!bucketById.has(relation.from) || !bucketById.has(relation.to)) return;
      if (relation.from === relation.to) return;
      const pairKey = [relation.from, relation.to].sort().join("::");
      if (!counts.has(pairKey)) order.push(pairKey);
      counts.set(pairKey, (counts.get(pairKey) ?? 0) + 1);
    });

    return order.map(pairKey => {
      const [source, target] = pairKey.split("::");
      const count = counts.get(pairKey) ?? 1;
      return {
        id: pairKey,
        source,
        target,
        type: "default",
        style: {strokeWidth: EDGE_BASE_WIDTH + (count - 1)},
        markerEnd: {type: MarkerType.ArrowClosed, width: 16, height: 16}
      } satisfies Edge;
    });
  }, [relations, bucketById]);

  const [nodes, setNodes, onNodesChange] = useNodesState<DiagramFlowNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  const focusSet = useMemo(() => {
    if (!selectedId) return null;
    const set = new Set<string>([selectedId]);
    relations.forEach(relation => {
      if (relation.from === selectedId) set.add(relation.to);
      else if (relation.to === selectedId) set.add(relation.from);
    });
    return set;
  }, [selectedId, relations]);

  const styledNodes = useMemo<DiagramFlowNode[]>(() => {
    return nodes.map(node => {
      if (node.type !== "bucketNode") return node;
      let focus: NodeFocusVariant | undefined;
      if (focusSet) {
        if (node.id === selectedId) focus = "focused";
        else if (focusSet.has(node.id)) focus = "related";
        else focus = "unfocused";
      }
      return {...node, data: {...node.data, focus, selected: node.id === selectedId}};
    });
  }, [nodes, focusSet, selectedId]);

  const styledEdges = useMemo<Edge[]>(() => {
    return edges.map(edge => {
      if (!focusSet) return {...edge, className: undefined, animated: false};
      const connected = focusSet.has(edge.source) && focusSet.has(edge.target);
      return {
        ...edge,
        className: connected ? styles.edgeFocused : styles.edgeDimmed,
        animated: connected,
        style: {...edge.style, strokeWidth: connected ? EDGE_FOCUS_WIDTH : edge.style?.strokeWidth}
      };
    });
  }, [edges, focusSet]);

  const handleNodeClick = useCallback<NodeMouseHandler>((_event, node) => {
    if (node.type !== "bucketNode") return;
    setSelectedId(prev => (prev === node.id ? null : node.id));
  }, []);

  const handlePaneClick = useCallback(() => setSelectedId(null), []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const selectedBucket = selectedId ? bucketById.get(selectedId) : undefined;
  const selectedFields = selectedId ? fieldsById.get(selectedId) : undefined;

  if (isLoading) {
    return (
      <div className={styles.diagram}>
        <div className={styles.skeleton}>
          {Array.from({length: 6}).map((_, index) => (
            <span key={index} className={styles.skeletonNode} />
          ))}
        </div>
      </div>
    );
  }

  if (!isLoading && buckets.length === 0) {
    return (
      <div className={styles.diagram}>
        <div className={styles.emptyState}>
          <Icon name="bucket" className={styles.emptyIcon} />
          <span className={styles.emptyTitle}>No buckets yet</span>
          <span className={styles.emptyText}>Create your first bucket to see the constellation.</span>
          <EditBucket mode="create">
            {({onOpen}) => (
              <Button onClick={onOpen} className={styles.emptyButton}>
                <Icon name="plus" size="sm" />
                <span>Create Bucket</span>
              </Button>
            )}
          </EditBucket>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.diagram}>
      {isError && (
        <div className={styles.errorBanner} role="alert">
          <Icon name="bug" size="sm" />
          <span>Failed to load buckets.</span>
          <Button variant="text" onClick={() => refetch()} className={styles.retryButton}>
            Retry
          </Button>
        </div>
      )}

      <ReactFlow
        nodes={styledNodes}
        edges={styledEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        colorMode={colorMode}
        minZoom={0.03}
        maxZoom={3}
        fitView
        fitViewOptions={{padding: 0.4, maxZoom: 0.8}}
        proOptions={{hideAttribution: true}}
      >
        <Background />
        <MiniMap pannable zoomable />
        <Controls />
      </ReactFlow>

      {selectedBucket && selectedFields && (
        <BucketDiagramInspector
          bucket={selectedBucket}
          fields={selectedFields}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
