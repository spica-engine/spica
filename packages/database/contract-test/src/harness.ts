import {DriverCapabilities, ICollection} from "@spica-server/database-driver";

/**
 * The contract test package's single point of contact with a driver (K-2).
 *
 * The suite depends on no driver: it exercises `ICollection` behaviour and gets the collection through
 * this interface. `test/mongo.spec.ts` implements it for Mongo, and its counterpart, to be written in
 * Phase 4, does so for PostgreSQL — **the same suite** runs against both.
 */
export interface ContractHarness {
  /** The driver's name; it appears in the test titles. */
  readonly name: string;

  /**
   * The driver's capability declaration (K-10).
   *
   * The suite reads it and **verifies a declared absence too**: on a driver with `nativeTTLIndex: false`,
   * for instance, `upsertTTLIndex` must not succeed silently, it has to throw
   * `UnsupportedCapabilityError`. Declaring a capability and not keeping the behaviour would be exactly
   * the silent difference K-10 forbids.
   */
  readonly capabilities: DriverCapabilities;

  /**
   * Returns an empty collection. A second call with the same `name` must not see the previous one's data
   * (the suite wants a fresh collection in every test).
   */
  open<T = any>(name: string, options?: HarnessCollectionOptions): Promise<ICollection<T>>;

  /** Releases the connections and resources once the tests are done. */
  teardown(): Promise<void>;
}

export interface HarnessCollectionOptions {
  /** The counterpart of `documentSettings.countLimit`; the contract requires a write to be rejected once the limit is exceeded. */
  entryLimit?: number;
}
