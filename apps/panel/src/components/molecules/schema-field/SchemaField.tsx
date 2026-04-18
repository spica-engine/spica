import type {ConfigSchemaProperty} from "../../../store/api/configApi";
import SchemaIntegerField from "../schema-integer-field/SchemaIntegerField";
import SchemaBooleanField from "../schema-boolean-field/SchemaBooleanField";
import SchemaStringField from "../schema-string-field/SchemaStringField";
import SchemaArrayField from "../schema-array-field/SchemaArrayField";
import SchemaObjectSection from "../schema-object-section/SchemaObjectSection";

type BatchUpdater = (updater: (prev: Record<string, unknown>) => Record<string, unknown>) => void;

type SchemaFieldProps = {
  path: string;
  schema: ConfigSchemaProperty;
  options: Record<string, unknown>;
  onBatchUpdate: BatchUpdater;
  onUpdate: (path: string, value: unknown) => void;
  showHeader?: boolean;
};

const SchemaField = ({path, schema, options, onBatchUpdate, onUpdate, showHeader = true}: SchemaFieldProps) => {
  if (schema.type === "object" && schema.properties) {
    return (
      <SchemaObjectSection
        path={path}
        schema={schema}
        options={options}
        onBatchUpdate={onBatchUpdate}
        onUpdate={onUpdate}
        showHeader={showHeader}
      />
    );
  }

  if (schema.type === "array") {
    return (
      <SchemaArrayField
        path={path}
        schema={schema}
        options={options}
        onBatchUpdate={onBatchUpdate}
      />
    );
  }

  if (schema.type === "boolean") {
    return <SchemaBooleanField path={path} schema={schema} options={options} onUpdate={onUpdate} />;
  }

  if (schema.type === "integer" || schema.type === "number") {
    return <SchemaIntegerField path={path} schema={schema} options={options} onUpdate={onUpdate} />;
  }

  if (schema.type === "string") {
    return <SchemaStringField path={path} schema={schema} options={options} onUpdate={onUpdate} />;
  }

  return null;
};

export default SchemaField;
