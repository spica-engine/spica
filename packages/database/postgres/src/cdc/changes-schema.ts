import {SqlFragment} from "../compiler/expression-to-sql.js";
import {SYSTEM_SCHEMA} from "../schema/naming.js";

export const CHANGES_TABLE = "_changes";
export const CHANGES_CHANNEL = "spica_changes";

const qualified = `${SYSTEM_SCHEMA}."${CHANGES_TABLE}"`;

/**
 * The CDC outbox. `txid xid8` is the **watermark column**: consumer progress runs on it, not on `seq`, because
 * across sessions a transaction with a high txid can get a low `seq` and the row would then fall outside every
 * later query — measured as silent event loss under parallel writers.
 */
/**
 * The schema of the CDC outbox. `doc_id` is **`text`**, not `char(24)`: a free-text id (`TableSpec.idKind`)
 * does not fit, and the trigger would fail on every write to those tables.
 */
export function compileCreateChangesTable(): SqlFragment[] {
  return [
    {sql: `CREATE SCHEMA IF NOT EXISTS "${SYSTEM_SCHEMA}"`, params: []},
    {
      sql: `CREATE TABLE IF NOT EXISTS ${qualified} (
         "seq"            bigserial PRIMARY KEY,
         "txid"           xid8 NOT NULL DEFAULT pg_current_xact_id(),
         "coll"           text NOT NULL,
         "op"             text NOT NULL,
         -- text, NOT char(24): the id of the jobs/commands tables is not an ObjectId
         -- (a resume token, uniqid()) and TableSpec.idKind "text" declares exactly that.
         "doc_id"         text NOT NULL,
         "full_doc"       jsonb,
         "before_doc"     jsonb,
         "updated_fields" jsonb,
         "removed_fields" jsonb,
         "ts"             timestamptz NOT NULL DEFAULT now()
       )`,
      params: []
    },
    /**
     * `seq`'s sequence **must** be `CACHE 1`: a per-session cache breaks the order values are handed out in, and
     * `seq` carries the order within a transaction. It is written out although 1 is the default, because
     * `ALTER SEQUENCE … CACHE n` would break it silently.
     */
    {sql: `ALTER SEQUENCE ${SYSTEM_SCHEMA}."${CHANGES_TABLE}_seq_seq" CACHE 1`, params: []},
    // The read round's only access pattern; the index's column order matches it exactly.
    {
      sql: `CREATE INDEX IF NOT EXISTS "${CHANGES_TABLE}_txid_seq_idx"
              ON ${qualified} ("txid", "seq")`,
      params: []
    },
    /** The retention sweep runs on `ts`. */
    {
      sql: `CREATE INDEX IF NOT EXISTS "${CHANGES_TABLE}_ts_idx" ON ${qualified} ("ts")`,
      params: []
    }
  ];
}

/**
 * The trigger functions — **two of them, deliberately**: a `pg_notify` per row measured as the larger half of
 * the CDC write amplification.
 *
 * - `spica_changes_row()` — `FOR EACH ROW`, writes to the outbox only, no notify.
 * - `spica_changes_notify()` — `FOR EACH STATEMENT`, notifies once.
 *
 * The payload is fixed, so PostgreSQL collapses identical notifications inside one transaction: a 1000-row
 * `INSERT` notifies once.
 */
export function compileCreateTriggerFunctions(): SqlFragment[] {
  return [
    {
      sql: `CREATE OR REPLACE FUNCTION ${SYSTEM_SCHEMA}.spica_changes_row()
              RETURNS trigger LANGUAGE plpgsql AS $fn$
            DECLARE
              v_op  text;
              v_id  text;
              v_new jsonb;
              v_old jsonb;
              v_upd jsonb;
              v_rem jsonb;
            BEGIN
              IF TG_OP = 'INSERT' THEN
                v_op := 'insert';
                v_new := to_jsonb(NEW);
                v_id := NEW."_id";
              ELSIF TG_OP = 'DELETE' THEN
                v_op := 'delete';
                v_old := to_jsonb(OLD);
                v_id := OLD."_id";
              ELSE
                v_new := to_jsonb(NEW);
                v_old := to_jsonb(OLD);
                v_id := NEW."_id";

                SELECT jsonb_object_agg(key, value)
                  INTO v_upd
                  FROM jsonb_each(v_new)
                 WHERE value IS DISTINCT FROM (v_old -> key)
                   AND value <> 'null'::jsonb;

                SELECT jsonb_agg(key)
                  INTO v_rem
                  FROM jsonb_each(v_old)
                 WHERE value <> 'null'::jsonb
                   AND (v_new -> key) = 'null'::jsonb;

                v_op := coalesce(nullif(current_setting('spica.change_op', true), ''), 'update');
              END IF;

              INSERT INTO ${qualified}
                ("coll", "op", "doc_id", "full_doc", "before_doc", "updated_fields", "removed_fields")
              VALUES (TG_TABLE_NAME, v_op, v_id, v_new, v_old, v_upd, v_rem);

              RETURN NULL;
            END;
            $fn$`,
      params: []
    },
    {
      sql: `CREATE OR REPLACE FUNCTION ${SYSTEM_SCHEMA}.spica_changes_notify()
              RETURNS trigger LANGUAGE plpgsql AS $fn$
            BEGIN
              -- The payload is empty: the notification is only a "start a read round" signal, it carries no data.
              PERFORM pg_notify('${CHANGES_CHANNEL}', '');
              RETURN NULL;
            END;
            $fn$`,
      params: []
    }
  ];
}

/**
 * Attaches the triggers to a collection's table. Called automatically for a new collection.
 *
 * `CREATE OR REPLACE TRIGGER` requires PostgreSQL 14+; being idempotent makes it safe to set every table
 * up again at startup.
 */
export function compileAttachTriggers(collection: string, schema: string): SqlFragment[] {
  const table = `${schema}."${collection}"`;
  return [
    {
      sql: `CREATE OR REPLACE TRIGGER "spica_changes_row_trg"
              AFTER INSERT OR UPDATE OR DELETE ON ${table}
              FOR EACH ROW EXECUTE FUNCTION ${SYSTEM_SCHEMA}.spica_changes_row()`,
      params: []
    },
    {
      sql: `CREATE OR REPLACE TRIGGER "spica_changes_notify_trg"
              AFTER INSERT OR UPDATE OR DELETE ON ${table}
              FOR EACH STATEMENT EXECUTE FUNCTION ${SYSTEM_SCHEMA}.spica_changes_notify()`,
      params: []
    }
  ];
}

/**
 * The retention record of the CDC outbox.
 *
 * The outbox cannot grow without bound: every write adds a row, and the value of the consumed rows is
 * only as long as the slowest consumer's resume window. The sweep was handed over to the
 * `TtlSweeper` — setting up a separate timer would mean doing the same job in two places.
 *
 * **The retention period is the resume window.** A consumer that asks to resume with a token older than
 * this period gets `ChangeStreamHistoryLost`; so the period is the longest time an API pod is given to
 * drop out and come back.
 */
export function changesRetention(seconds: number) {
  return {table: CHANGES_TABLE, field: "ts", seconds, key: "seq"};
}
