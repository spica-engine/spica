import type {Relation} from "../hooks/useBucketConverter";

export interface ConstellationInputNode {
  id: string;
  fieldCount: number;
}

export interface ConstellationNode {
  id: string;
  /** World-space CENTER of the node (React Flow positions are top-left; the page offsets by size/2). */
  position: {x: number; y: number};
  /** Diameter in px; scales with the bucket's distinct-neighbor count. */
  size: number;
  /** Distinct connected buckets. Drives both size and ring placement. */
  degree: number;
  /** Total relation edges touching this bucket (badge count). */
  relationCount: number;
  ring: number;
  isIsolated: boolean;
}

export interface ConstellationLayout {
  nodes: ConstellationNode[];
  /** Present only when isolated buckets exist, so the page can label the periphery ring. */
  isolatedLabel: {position: {x: number; y: number}} | null;
}

const RING_GAP_BASE = 340;
// Floors are sized so a two-line ~28px bucket title clears the circular card
// without spilling past the border at the smallest (low-degree/isolated) nodes.
const SIZE_MIN = 116;
const SIZE_MAX = 210;
const SIZE_PER_DEGREE = 16;
const SIZE_ISOLATED = 104;
const RING_STAGGER = 0.4;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const sizeForDegree = (degree: number): number =>
  degree === 0 ? SIZE_ISOLATED : clamp(SIZE_MIN + degree * SIZE_PER_DEGREE, SIZE_MIN, SIZE_MAX);

// Inner rings stay small so the most-connected hub reads as the gravitational center;
// capacity grows outward to keep angular spacing between neighbours roughly constant.
const ringCapacity = (ring: number): number => (ring === 0 ? 1 : ring * 6);

const SPACING_BASE = 2;
const SPACING_GROWTH_START = 12;
const SPACING_GROWTH_PER_NODE = 0.05;
const SPACING_MAX = 6;

// ~2x the original placement, growing further past a dozen buckets so relations on
// large schemas stay separable while small schemas aren't flung into the void.
const spacingScaleFor = (nodeCount: number): number =>
  clamp(
    SPACING_BASE + Math.max(0, nodeCount - SPACING_GROWTH_START) * SPACING_GROWTH_PER_NODE,
    SPACING_BASE,
    SPACING_MAX
  );

interface Degree {
  neighbors: Set<string>;
  edges: number;
}

const buildDegrees = (
  nodes: ConstellationInputNode[],
  relations: Relation[]
): Map<string, Degree> => {
  const degrees = new Map<string, Degree>();
  nodes.forEach(node => degrees.set(node.id, {neighbors: new Set(), edges: 0}));

  relations.forEach(relation => {
    const from = degrees.get(relation.from);
    const to = degrees.get(relation.to);
    // Self-relations still count as an edge but not as a distinct neighbour.
    if (from) {
      from.edges += 1;
      if (relation.to !== relation.from) from.neighbors.add(relation.to);
    }
    if (to && relation.to !== relation.from) {
      to.edges += 1;
      to.neighbors.add(relation.from);
    }
  });

  return degrees;
};

// Deterministic: identical (nodes, relations) always yields identical positions — no physics, no jitter.
export const computeConstellationLayout = (
  nodes: ConstellationInputNode[],
  relations: Relation[]
): ConstellationLayout => {
  const degrees = buildDegrees(nodes, relations);

  const ringGap = RING_GAP_BASE * spacingScaleFor(nodes.length);

  const degreeOf = (id: string) => degrees.get(id)?.neighbors.size ?? 0;

  const connected = nodes
    .filter(node => degreeOf(node.id) > 0)
    .sort((a, b) => degreeOf(b.id) - degreeOf(a.id) || a.id.localeCompare(b.id));

  const isolated = nodes
    .filter(node => degreeOf(node.id) === 0)
    .sort((a, b) => a.id.localeCompare(b.id));

  const placed: ConstellationNode[] = [];

  const pushNode = (id: string, position: {x: number; y: number}, ring: number, isIsolated: boolean) => {
    const degree = degreeOf(id);
    placed.push({
      id,
      position,
      size: sizeForDegree(degree),
      degree,
      relationCount: degrees.get(id)?.edges ?? 0,
      ring,
      isIsolated
    });
  };

  let cursor = 0;
  let ring = 0;
  let maxConnectedRing = 0;

  while (cursor < connected.length) {
    const capacity = ringCapacity(ring);
    const slice = connected.slice(cursor, cursor + capacity);
    const radius = ring * ringGap;

    slice.forEach((node, index) => {
      if (ring === 0) {
        pushNode(node.id, {x: 0, y: 0}, 0, false);
        return;
      }
      const angleStep = (2 * Math.PI) / slice.length;
      const angle = ring * RING_STAGGER + index * angleStep;
      pushNode(
        node.id,
        {x: radius * Math.cos(angle), y: radius * Math.sin(angle)},
        ring,
        false
      );
    });

    if (slice.length > 0) maxConnectedRing = ring;
    cursor += capacity;
    ring += 1;
  }

  let isolatedLabel: ConstellationLayout["isolatedLabel"] = null;

  if (isolated.length > 0) {
    const isolatedRing = (connected.length > 0 ? maxConnectedRing + 2 : 1);
    const radius = isolatedRing * ringGap;
    const angleStep = (2 * Math.PI) / isolated.length;

    isolated.forEach((node, index) => {
      const angle = -Math.PI / 2 + index * angleStep;
      pushNode(
        node.id,
        {x: radius * Math.cos(angle), y: radius * Math.sin(angle)},
        isolatedRing,
        true
      );
    });

    isolatedLabel = {position: {x: 0, y: -(radius + 110)}};
  }

  return {nodes: placed, isolatedLabel};
};
