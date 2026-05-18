import type {ConfigSchemaProperty} from "../../../store/api/configApi";
import SchemaField from "../../molecules/schema-field/SchemaField";

type BatchUpdater = (updater: (prev: Record<string, unknown>) => Record<string, unknown>) => void;

type SchemaFormRendererProps = {
  schema: ConfigSchemaProperty;
  options: Record<string, unknown>;
  onBatchUpdate: BatchUpdater;
  onUpdate: (path: string, value: unknown) => void;
};

const SchemaFormRenderer = ({schema, options, onBatchUpdate, onUpdate}: SchemaFormRendererProps) => {
  if (!schema || !schema.properties) return null;

  return (
    <>
      {Object.entries(schema.properties).map(([key, propSchema]) => (
        <SchemaField
          key={key}
          path={key}
          schema={propSchema}
          options={options}
          onBatchUpdate={onBatchUpdate}
          onUpdate={onUpdate}
        />
      ))}
    </>
  );
};

export default SchemaFormRenderer;
