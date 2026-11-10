import {literalOf, quote} from "@spica-server/data-postgresql-orm";
import pg from "pg";

export const CHANGE_CHANNEL = "spica_change";
export const CHANGE_TRIGGER = "spica_change";
export const CHANGE_SEQUENCE = "spica_change_seq";
export const CHANGE_FUNCTION = "spica_notify_change";

const CHANGE_LOCK = "spica_change_function";

const MAX_PAYLOAD_BYTES = 8000;

export const changeSequenceSql = `CREATE SEQUENCE IF NOT EXISTS ${CHANGE_SEQUENCE}`;

export const changeFunctionSql = `CREATE OR REPLACE FUNCTION ${CHANGE_FUNCTION}() RETURNS trigger LANGUAGE plpgsql AS $function$
DECLARE
  current_ jsonb;
  previous_ jsonb;
  changed_ text[];
  kept_ jsonb;
  payload_ jsonb;
  field_ text := TG_ARGV[2];
  before_ text := TG_ARGV[3];
BEGIN
  IF TG_OP = 'DELETE' THEN
    current_ := to_jsonb(OLD);
  ELSE
    current_ := to_jsonb(NEW);
  END IF;

  IF TG_OP = 'UPDATE' THEN
    previous_ := to_jsonb(OLD);
    SELECT array_agg(entry.key ORDER BY entry.key) INTO changed_
      FROM jsonb_each(current_) AS entry
      WHERE entry.value IS DISTINCT FROM (previous_ -> entry.key);
    IF changed_ IS NULL THEN
      RETURN NULL;
    END IF;
  END IF;

  payload_ := jsonb_build_object(
    't', TG_ARGV[0],
    'op', CASE WHEN field_ <> '' THEN 'update' ELSE lower(TG_OP) END,
    'k', current_ ->> TG_ARGV[1],
    'x', pg_current_xact_id()::text,
    's', nextval('${CHANGE_SEQUENCE}')
  );

  IF field_ <> '' THEN
    payload_ := payload_ || jsonb_build_object('f', jsonb_build_array(field_));
  ELSIF changed_ IS NOT NULL THEN
    payload_ := payload_ || jsonb_build_object('c', to_jsonb(changed_));
  END IF;

  IF before_ <> '' AND TG_OP <> 'INSERT' THEN
    previous_ := coalesce(previous_, to_jsonb(OLD));
    SELECT jsonb_object_agg(entry.key, entry.value) INTO kept_
      FROM jsonb_each(previous_) AS entry
      WHERE entry.key = ANY (string_to_array(before_, ','));
    payload_ := payload_ || jsonb_build_object('b', kept_);
  END IF;

  IF octet_length(payload_::text) >= ${MAX_PAYLOAD_BYTES} THEN
    payload_ := payload_ - 'c' - 'b';
  END IF;

  PERFORM pg_notify('${CHANGE_CHANNEL}', payload_::text);
  RETURN NULL;
END
$function$`;

export const changeFunctionStatements = [changeSequenceSql, changeFunctionSql];

export interface ChangeTriggerArguments {
  target: string;
  keyColumn: string;
  field?: string;
  beforeColumns?: string[];
}

export const createChangeTriggerSql = (table: string, args: ChangeTriggerArguments) =>
  `CREATE OR REPLACE TRIGGER ${quote(CHANGE_TRIGGER)} AFTER INSERT OR UPDATE OR DELETE ON ${quote(table)} FOR EACH ROW EXECUTE FUNCTION ${CHANGE_FUNCTION}(${[
    args.target,
    args.keyColumn,
    args.field ?? "",
    (args.beforeColumns ?? []).join(",")
  ]
    .map(literalOf)
    .join(", ")})`;

export const dropChangeTriggerSql = (table: string) =>
  `DROP TRIGGER IF EXISTS ${quote(CHANGE_TRIGGER)} ON ${quote(table)}`;

export async function installChangeFunction(pool: pg.Pool) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [CHANGE_LOCK]);
    for (const statement of changeFunctionStatements) {
      await client.query(statement);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
