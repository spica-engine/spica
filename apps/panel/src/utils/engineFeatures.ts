import type {DataEngine} from "../store/api/statusApi";

export type EngineFeature = "profiler";

const UNAVAILABLE_ON_POSTGRESQL: ReadonlySet<EngineFeature> = new Set(["profiler"]);

export const isFeatureAvailable = (feature: EngineFeature, engine: DataEngine | undefined): boolean =>
  !(engine === "postgresql" && UNAVAILABLE_ON_POSTGRESQL.has(feature));
