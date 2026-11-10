CREATE SEQUENCE IF NOT EXISTS spica_change_seq;

CREATE OR REPLACE FUNCTION spica_notify_change() RETURNS trigger LANGUAGE plpgsql AS $function$
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
    's', nextval('spica_change_seq')
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

  IF octet_length(payload_::text) >= 8000 THEN
    payload_ := payload_ - 'c' - 'b';
  END IF;

  PERFORM pg_notify('spica_change', payload_::text);
  RETURN NULL;
END
$function$;

DO $migration$
DECLARE
  owner_ text;
  table_ record;
  target_ text;
  key_ text;
  field_ text;
BEGIN
  SELECT pg_get_userbyid(datdba) INTO owner_ FROM pg_database WHERE datname = current_database();
  EXECUTE format('ALTER SEQUENCE spica_change_seq OWNER TO %I', owner_);
  EXECUTE format('ALTER FUNCTION spica_notify_change() OWNER TO %I', owner_);

  FOR table_ IN
    SELECT relname AS name
    FROM pg_class
    WHERE relnamespace = current_schema()::regnamespace
      AND relkind = 'r'
      AND relname LIKE 'bucket\_%'
  LOOP
    IF position('__' IN table_.name) > 0 THEN
      target_ := split_part(table_.name, '__', 1);
      key_ := '_parent';
      field_ := CASE WHEN length(table_.name) < 63 THEN split_part(table_.name, '__', 2) ELSE '*' END;
    ELSE
      target_ := table_.name;
      field_ := '';
      SELECT attribute.attname INTO key_
      FROM pg_index AS index
      JOIN pg_attribute AS attribute ON attribute.attrelid = index.indrelid AND attribute.attnum = index.indkey[0]
      WHERE index.indrelid = format('%I', table_.name)::regclass AND index.indisprimary;
    END IF;

    EXECUTE format(
      'CREATE OR REPLACE TRIGGER spica_change AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION spica_notify_change(%L, %L, %L, %L)',
      table_.name, target_, key_, field_, ''
    );
  END LOOP;
END
$migration$;
