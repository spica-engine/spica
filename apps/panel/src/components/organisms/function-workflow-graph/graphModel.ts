import type {Edge, Node} from "@xyflow/react";
import type {SpicaFunction} from "../../../store/api/functionApi";
import type {BucketType} from "../../../store/api/bucketApi";
import {normalizeTriggers, type NormalizedTrigger} from "../../../utils/functionTriggers";

export type NodeFocus = "focused" | "related" | "dimmed";

export type FunctionHubData = {
  functionId: string;
  handler: string;
  name: string;
  connectionCount: number;
  focus?: NodeFocus;
};

export type DataSatelliteData = {
  kind: "bucket" | "database";
  label: string;
  connectionCount: number;
  functionIds: string[];
  focus?: NodeFocus;
};

export type WorkflowEdgeData = {
  functionId: string;
};

type FunctionAdjacency = {
  nodeIds: string[];
  edgeIds: string[];
};

export type WorkflowModel = {
  nodes: Node[];
  edges: Edge[];
  functionIds: string[];
  adjacency: Record<string, FunctionAdjacency>;
};

// Deterministic two-column layout — no physics/jitter so the graph renders
// identically on every mount. Deduplicated bucket/database (data) sources fill the
// LEFT column and their consuming functions fill the RIGHT column, so triggers read
// left→right. Only functions that own at least one data trigger are drawn; an orphan
// function has no edge to render and is intentionally omitted. Vertical order inside
// each column is solved with a barycenter sweep that reduces edge crossings.
const DATA_COLUMN_X = 0;
const FUNCTION_COLUMN_X = 520;
const ROW_GAP_Y = 150;
const BARYCENTER_SWEEPS = 4;

// Center a column of `count` rows around y=0 so the shorter column stays balanced
// against the taller one and fitView frames both columns symmetrically.
const columnRowY = (count: number, index: number): number =>
  index * ROW_GAP_Y - ((count - 1) * ROW_GAP_Y) / 2;

const average = (values: number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

const capitalize = (value: string): string =>
  value.length === 0 ? value : value.charAt(0).toUpperCase() + value.slice(1);

const hubHandler = (triggers: NormalizedTrigger[], fallback: string): string => {
  const named = triggers.find(trigger => trigger.name);
  return named?.name ?? fallback;
};

// Identity of a data source, so a bucket/collection used by N functions collapses
// to a SINGLE node keyed here rather than one duplicate node per function.
const dataSourceKey = (trigger: NormalizedTrigger): string =>
  trigger.type === "bucket"
    ? `bucket:${trigger.options.bucket as string}`
    : `db:${(trigger.options.collection as string) ?? "collection"}`;

const dataSourceLabel = (
  trigger: NormalizedTrigger,
  bucketNameById: Map<string, string>
): string => {
  if (trigger.type === "bucket") {
    const bucketId = trigger.options.bucket as string;
    return bucketNameById.get(bucketId) ?? bucketId;
  }
  return (trigger.options.collection as string) ?? "collection";
};

const dataEdgeLabel = (trigger: NormalizedTrigger): string => {
  const phase = (trigger.options.type ?? trigger.options.phase) as string | undefined;
  if (!phase) return trigger.type === "bucket" ? "change" : "op";
  return trigger.type === "bucket" ? `on${capitalize(phase)}` : phase.toUpperCase();
};

const isDataTrigger = (trigger: NormalizedTrigger): boolean =>
  (trigger.type === "bucket" && Boolean(trigger.options.bucket)) ||
  (trigger.type === "database" && Boolean(trigger.options.collection));

export const buildWorkflowModel = (
  functions: SpicaFunction[],
  buckets: BucketType[]
): WorkflowModel => {
  const bucketNameById = new Map(buckets.map(bucket => [bucket._id, bucket.title]));

  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const functionIds: string[] = [];
  const adjacency: Record<string, FunctionAdjacency> = {};

  type DataSource = {
    key: string;
    kind: "bucket" | "database";
    label: string;
    functionIds: string[];
    edges: {fnId: string; phase: string; active: boolean}[];
  };
  const dataSources = new Map<string, DataSource>();
  const dataSourceOrder: string[] = [];

  // Keep only functions with a real data connection — an orphan hub (no bucket/db
  // trigger) has no edge to draw and is intentionally omitted from the graph.
  const connectedFunctions = functions
    .map((fn, index) => {
      const fnId = fn._id ?? `fn-${index}`;
      const triggers = normalizeTriggers(fn);
      const dataTriggers = triggers.filter(isDataTrigger);
      return {fn, fnId, triggers, dataTriggers};
    })
    .filter(entry => entry.dataTriggers.length > 0);

  // Fold each function's data triggers into shared, deduplicated data sources (one
  // entry per bucket/collection) while recording adjacency for focus highlighting.
  connectedFunctions.forEach(({fnId, dataTriggers}) => {
    functionIds.push(fnId);
    adjacency[fnId] = {nodeIds: [`hub-${fnId}`], edgeIds: []};

    dataTriggers.forEach(trigger => {
      const key = dataSourceKey(trigger);
      let source = dataSources.get(key);
      if (!source) {
        source = {
          key,
          kind: trigger.type === "bucket" ? "bucket" : "database",
          label: dataSourceLabel(trigger, bucketNameById),
          functionIds: [],
          edges: []
        };
        dataSources.set(key, source);
        dataSourceOrder.push(key);
      }
      if (!source.functionIds.includes(fnId)) source.functionIds.push(fnId);
      source.edges.push({fnId, phase: dataEdgeLabel(trigger), active: trigger.active});
    });
  });

  const fnEntryById = new Map(connectedFunctions.map(entry => [entry.fnId, entry]));

  // Reverse index (function → its data-source keys) so the barycenter sweep can
  // reorder either column against the other in O(edges) per pass.
  const functionDataKeys = new Map<string, string[]>();
  dataSourceOrder.forEach(key => {
    dataSources.get(key)!.functionIds.forEach(fnId => {
      const keys = functionDataKeys.get(fnId) ?? [];
      keys.push(key);
      functionDataKeys.set(fnId, keys);
    });
  });

  // Barycenter crossing reduction: alternately pin one column and sort the other by
  // the mean row of its neighbours. Array.sort is stable, so equal barycenters keep
  // their prior order and the result stays fully deterministic across mounts.
  let functionOrder = connectedFunctions.map(entry => entry.fnId);
  let dataOrder = [...dataSourceOrder];

  for (let sweep = 0; sweep < BARYCENTER_SWEEPS; sweep++) {
    const fnRow = new Map(functionOrder.map((fnId, row) => [fnId, row]));
    const dataBary = new Map(
      dataOrder.map(key => [
        key,
        average(dataSources.get(key)!.functionIds.map(fnId => fnRow.get(fnId) ?? 0))
      ])
    );
    dataOrder = [...dataOrder].sort((a, b) => dataBary.get(a)! - dataBary.get(b)!);

    const dataRow = new Map(dataOrder.map((key, row) => [key, row]));
    const fnBary = new Map(
      functionOrder.map(fnId => [
        fnId,
        average((functionDataKeys.get(fnId) ?? []).map(key => dataRow.get(key) ?? 0))
      ])
    );
    functionOrder = [...functionOrder].sort((a, b) => fnBary.get(a)! - fnBary.get(b)!);
  }

  // Right column: one function hub per connected function, in solved vertical order.
  functionOrder.forEach((fnId, index) => {
    const entry = fnEntryById.get(fnId)!;
    nodes.push({
      id: `hub-${fnId}`,
      type: "functionHub",
      position: {x: FUNCTION_COLUMN_X, y: columnRowY(functionOrder.length, index)},
      data: {
        functionId: fnId,
        handler: hubHandler(entry.triggers, entry.fn.name),
        name: entry.fn.name,
        connectionCount: entry.dataTriggers.length
      } satisfies FunctionHubData
    });
  });

  // Left column: one node per deduplicated data source, fanning an edge rightward to
  // every function that consumes it (data.right handle → hub.left handle).
  dataOrder.forEach((key, index) => {
    const source = dataSources.get(key)!;
    const satelliteId = `sat-${key}`;

    nodes.push({
      id: satelliteId,
      type: "dataSatellite",
      position: {x: DATA_COLUMN_X, y: columnRowY(dataOrder.length, index)},
      data: {
        kind: source.kind,
        label: source.label,
        connectionCount: source.functionIds.length,
        functionIds: [...source.functionIds]
      } satisfies DataSatelliteData
    });

    source.functionIds.forEach(fnId => adjacency[fnId].nodeIds.push(satelliteId));

    source.edges.forEach((edge, edgeIndex) => {
      const edgeId = `edge-${edge.fnId}-${key}-${edgeIndex}`;
      edges.push({
        id: edgeId,
        source: satelliteId,
        target: `hub-${edge.fnId}`,
        sourceHandle: "sourceRight",
        targetHandle: "targetLeft",
        label: edge.phase,
        animated: edge.active,
        data: {functionId: edge.fnId} satisfies WorkflowEdgeData
      });

      adjacency[edge.fnId].edgeIds.push(edgeId);
    });
  });

  return {nodes, edges, functionIds, adjacency};
};
