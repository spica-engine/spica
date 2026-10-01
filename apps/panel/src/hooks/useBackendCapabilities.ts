import {useMemo} from "react";
import {useGetCapabilitiesQuery, type DriverCapabilities} from "../store/api/statusApi";

/**
 * What this installation's database backend can actually do.
 *
 * The panel asks questions here instead of reading the raw declaration, because the useful question is
 * never "which backend is this" — it is "should I offer this control". Keying on the backend name would
 * put the same rule in two places and go stale the moment a third backend appears.
 *
 * **Everything defaults to available.** Until the answer arrives — and on an older API that has no such
 * endpoint — the panel behaves exactly as it did before. Hiding a working control is worse than showing one
 * that turns out to fail: the failure is visible and recoverable, the missing control is invisible.
 */

/**
 * Index kinds the driver contract does not carry: `IndexDirection` is `1 | -1`, so `text`, `2dsphere`, `2d`
 * and `hashed` are MongoDB-only. They are offered on MongoDB because that is where they work.
 */
const MONGO_ONLY_INDEX_KINDS = ["text", "2dsphere", "2d", "hashed"] as const;

export type BackendCapabilities = {
  /** `undefined` until the declaration arrives, or on an API that does not publish one. */
  declaration?: DriverCapabilities;
  /** The backend's name, for the read-only display provisioning requires. */
  backend?: string;
  database?: string;
  isLoading: boolean;

  /** A collation on an index. PostgreSQL declares `indexOptions.collation: false` and the driver raises. */
  supportsCollation: boolean;
  supportsSparseIndex: boolean;
  supportsPartialIndex: boolean;
  /**
   * `text`/`2dsphere`/`2d`/`hashed`. Without a counterpart these do not fail loudly — PostgreSQL reads any
   * direction other than `-1` as ascending, so the user would get a plain btree index and no warning.
   */
  supportsMongoOnlyIndexKinds: boolean;
  /**
   * Whether retention is a real TTL index. On PostgreSQL it is a sweeper registration instead: the field
   * works and means the same thing, only the mechanism differs — so this **labels** the control, it does
   * not hide it.
   */
  hasNativeTTLIndex: boolean;
  /** The `system.profile` view the observability screens read. PostgreSQL exposes `pg_stat_statements`. */
  hasQueryProfiler: boolean;
  /** Whether a raw Mongo JSON filter is accepted in full; `"subset"` means the common operators only. */
  rawMongoFilter: boolean | "subset";
};

export function useBackendCapabilities(): BackendCapabilities {
  const {data, isLoading} = useGetCapabilitiesQuery();

  return useMemo(() => {
    const declaration = data?.capabilities;

    // `?? true` / `!== false` throughout: an absent declaration must not take a control away.
    return {
      declaration,
      backend: data?.backend,
      database: data?.database,
      isLoading,

      supportsCollation: declaration?.indexOptions?.collation !== false,
      supportsSparseIndex: declaration?.indexOptions?.sparse !== false,
      supportsPartialIndex: declaration?.indexOptions?.partial !== false,
      supportsMongoOnlyIndexKinds: declaration ? declaration.backend === "mongodb" : true,
      hasNativeTTLIndex: declaration?.nativeTTLIndex !== false,
      hasQueryProfiler: declaration ? declaration.queryProfiler === "system.profile" : true,
      rawMongoFilter: declaration?.rawMongoFilter ?? true
    };
  }, [data, isLoading]);
}

export {MONGO_ONLY_INDEX_KINDS};
