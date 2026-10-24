import {DatabaseService} from "./database.service.js";

export const INSTANCE_COLLECTION = "instance";

export interface InstanceRecord {
  instanceId: string;
  backend: string;
  createdAt: Date;
}

export interface InstanceGuardOptions {
  /**
   * The identity coming from the provisioning layer (an HQ id or a Helm release name). **Without it the
   * guard is disabled** — so that existing users who install by hand with `docker run` are not affected
   * (backwards compatibility).
   */
  instanceId?: string;
  /**
   * Given only on provisioning's **first** installation. Under GitOps, if the backend in values changes,
   * the API will not start on an empty database because the flag is not set; the data is not split in
   * two.
   */
  initialize?: boolean;
}

/**
 * The error messages contain the remedy: the moment this check fires is the moment the operator has to
 * understand what they connected wrongly.
 */
export class InstanceGuardError extends Error {}

/**
 * The guard against a silent backend switch.
 *
 * The scenario it protects against: an installation's URI (or the `database.backend` value in the chart)
 * changes, the API starts happily on a new and **empty** database, nobody notices and the data is split
 * in two. It works the same way on Mongo and on PostgreSQL — the two backends are equal.
 */
export async function guardInstance(
  database: DatabaseService,
  options: InstanceGuardOptions
): Promise<void> {
  if (!options.instanceId) return;

  const collection = database.collection<InstanceRecord>(INSTANCE_COLLECTION);
  const existing = await collection.findOne({});

  if (existing) {
    if (existing.instanceId !== options.instanceId) {
      throw new InstanceGuardError(
        `This database belongs to instance '${existing.instanceId}' but --instance-id is ` +
          `'${options.instanceId}'. Refusing to start: check --database-uri, or use the correct ` +
          `instance id.`
      );
    }

    /**
     * The same instance on a different backend: it means the URI scheme changed. This is exactly the
     * form of splitting the data we want to guard against — the record says which backend it was written
     * on.
     */
    if (existing.backend !== database.capabilities.backend) {
      throw new InstanceGuardError(
        `Instance '${options.instanceId}' was initialized on '${existing.backend}' but is now ` +
          `starting on '${database.capabilities.backend}'. Refusing to start: moving between ` +
          `backends is a migration, not a configuration change.`
      );
    }

    return;
  }

  /**
   * There is no record. Two separate cases, and **whether the database is empty** tells them apart: a
   * populated database is an existing installation's first startup on a new version — write the record
   * and continue. An empty database is either a new installation (which needs the flag) or the wrong URI.
   */
  const collections = await database.listCollections();
  const populated = collections.some(c => c.name !== INSTANCE_COLLECTION);

  if (!populated && !options.initialize) {
    throw new InstanceGuardError(
      `Database is empty and --database-initialize was not given. If this is a new installation, ` +
        `start once with --database-initialize. If it is not, check --database-uri: you may be ` +
        `pointing at the wrong database.`
    );
  }

  await collection.insertOne({
    instanceId: options.instanceId,
    backend: database.capabilities.backend,
    createdAt: new Date()
  } as any);
}
