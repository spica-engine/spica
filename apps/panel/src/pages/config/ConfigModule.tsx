import React, {useCallback, useMemo, useState} from "react";
import {useParams} from "react-router-dom";
import {Button, Checkbox, Icon, Select, StringInput, Text} from "oziko-ui-kit";
import isEqual from "lodash/isEqual";
import Page from "../../components/organisms/page-layout/Page";
import {useUpdateConfigMutation} from "../../store/api/configApi";
import {configSchemas, type FieldMeta} from "./schemas";
import {
  type RateLimitValue,
  type ProviderItemWithId,
  genId,
  getNestedValue,
  setNestedValue,
  prepareOptions,
  sanitizeForSave,
  updateNestedArray,
  PROVIDER_OPTIONS,
  STRATEGY_OPTIONS
} from "./configUtils";
import styles from "./ConfigModule.module.scss";

function InputWithUnit({
  value,
  onChange,
  unit,
  placeholder
}: {
  value: string;
  onChange: (v: string) => void;
  unit?: string;
  placeholder?: string;
}) {
  return (
    <div className={styles.inputWithUnit}>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {unit && <span className={styles.unitLabel}>{unit}</span>}
    </div>
  );
}

function NumericField({
  path,
  meta,
  options,
  onUpdate,
  emptyValue = 0
}: {
  path: string;
  meta: FieldMeta;
  options: Record<string, unknown>;
  onUpdate: (path: string, value: unknown) => void;
  emptyValue?: "" | 0;
}) {
  const currentValue = getNestedValue(options, path);
  const displayValue = currentValue === undefined || currentValue === null || currentValue === "" ? "" : String(currentValue);

  const handleChange = (v: string) => {
    if (v === "") {
      onUpdate(path, emptyValue);
      return;
    }
    const num = parseInt(v, 10);
    if (!isNaN(num) && num >= 0) {
      onUpdate(path, num);
    }
  };

  return (
    <div className={styles.fieldRow}>
      <div className={styles.fieldInfo}>
        <span className={styles.fieldLabel}>{meta.label}</span>
        <span className={styles.fieldDescription}>{meta.description}</span>
      </div>
      <div className={styles.fieldInput}>
        <InputWithUnit
          value={displayValue}
          onChange={handleChange}
          unit={meta.unit}
          placeholder="0"
        />
      </div>
    </div>
  );
}
  path,
  meta,
  options,
  onUpdate
}: {
  path: string;
  meta: FieldMeta;
  options: Record<string, unknown>;
  onUpdate: (path: string, value: unknown) => void;
}) {
  const currentValue = !!getNestedValue(options, path);

  return (
    <div className={styles.checkboxRow}>
      <div className={styles.fieldInfo}>
        <span className={styles.fieldLabel}>{meta.label}</span>
        <span className={styles.fieldDescription}>{meta.description}</span>
      </div>
      <Checkbox checked={currentValue} onChange={() => onUpdate(path, !currentValue)} />
    </div>
  );
}

function ArrayProviderField({
  path,
  meta,
  items,
  setOptions,
  strategyOptions
}: {
  path: string;
  meta: FieldMeta;
  items: ProviderItemWithId[];
  setOptions: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  strategyOptions: {label: string; value: string}[];
}) {
  const updateItem = (index: number, field: "provider" | "strategy", value: string) => {
    setOptions(prev => updateNestedArray(prev, path, list => {
      const updated = [...list];
      updated[index] = {...updated[index], [field]: value};
      return updated;
    }));
  };

  const addItem = () => {
    setOptions(prev => updateNestedArray(prev, path, list => [
      ...list,
      {provider: "email", strategy: strategyOptions[0]?.value ?? "", _id: genId()}
    ]));
  };

  const removeItem = (index: number) => {
    setOptions(prev => updateNestedArray(prev, path, list => list.filter((_, i) => i !== index)));
  };

  return (
    <div className={styles.arraySection}>
      <div className={styles.arraySectionHeader}>
        <span className={styles.fieldLabel}>{meta.label}</span>
        <span className={styles.fieldDescription}>{meta.description}</span>
      </div>
      {items.map((item, index) => (
        <div key={item._id} className={styles.arrayRow}>
          <Select
            dimensionX="fill"
            dimensionY={36}
            options={PROVIDER_OPTIONS}
            value={item.provider}
            onChange={v => updateItem(index, "provider", v as string)}
            placeholder="Provider"
          />
          {strategyOptions.length > 0 ? (
            <Select
              dimensionX="fill"
              dimensionY={36}
              options={strategyOptions}
              value={item.strategy}
              onChange={v => updateItem(index, "strategy", v as string)}
              placeholder="Strategy"
            />
          ) : (
            <StringInput
              label="Strategy"
              value={item.strategy}
              onChange={v => updateItem(index, "strategy", v)}
            />
          )}
          <Button
            variant="icon"
            color="danger"
            onClick={() => removeItem(index)}
            className={styles.removeButton}
          >
            <Icon name="close" />
          </Button>
        </div>
      ))}
      <Button variant="text" color="primary" onClick={addItem} className={styles.addButton}>
        <Icon name="plus" /> Add
      </Button>
    </div>
  );
}

function GenericKeyValueFields({
  options,
  setOptions
}: {
  options: Record<string, unknown>;
  setOptions: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
}) {
  const keys = Object.keys(options);

  return (
    <>
      {keys.length === 0 && <Text>No options configured.</Text>}
      {keys.map(key => (
        <div key={key} className={styles.fieldRow}>
          <div className={styles.fieldInfo}>
            <span className={styles.fieldLabel} style={{textTransform: "capitalize"}}>
              {key.replace(/([A-Z])/g, " $1")}
            </span>
          </div>
          <div className={styles.fieldInput}>
            <InputWithUnit
              value={String(options[key] ?? "")}
              onChange={v => setOptions(prev => ({...prev, [key]: v}))}
            />
          </div>
        </div>
      ))}
    </>
  );
}

const ConfigModule = () => {
  const {module} = useParams<{module: string}>();
  const [updateConfig, {isLoading: isSaving}] = useUpdateConfigMutation();

  const [options, setOptions] = useState<Record<string, unknown>>({});
  const [baseline, setBaseline] = useState<Record<string, unknown>>({});

  const hasChanges = useMemo(() => !isEqual(options, baseline), [options, baseline]);

  const handleUpdate = useCallback((path: string, value: unknown) => {
    setOptions(prev => setNestedValue(prev, path, value));
  }, []);

  const handleSave = useCallback(async () => {
    if (!module || !hasChanges) return;
    const sanitized = sanitizeForSave(options);
    if (!sanitized) return;
    try {
      await updateConfig({module, options: sanitized}).unwrap();
      const refreshed = prepareOptions(sanitized);
      setBaseline(refreshed);
      setOptions(refreshed);
    } catch {
      // Error handled by RTK Query
    }
  }, [module, options, hasChanges, updateConfig]);

  const moduleSchema = module ? configSchemas[module] : undefined;

  if (!module) return null;

  const title = module.toUpperCase() + " CONFIGURATION";

  return (
    <Page title={title}>
      <div className={styles.moduleContainer}>
        {moduleSchema ? (
          <SchemaFields
            module={module}
            schema={moduleSchema}
            options={options}
            setOptions={setOptions}
            onUpdate={handleUpdate}
          />
        ) : (
          <GenericKeyValueFields options={options} setOptions={setOptions} />
        )}

        <div className={styles.saveRow}>
          <Button
            variant="solid"
            color="primary"
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className={styles.saveButton}
          >
            Save changes
          </Button>
        </div>
      </div>
    </Page>
  );
};

function SchemaFields({
  module,
  schema,
  options,
  setOptions,
  onUpdate
}: {
  module: string;
  schema: (typeof configSchemas)[string];
  options: Record<string, unknown>;
  setOptions: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  onUpdate: (path: string, value: unknown) => void;
}) {
  const {fieldMeta} = schema;

  if (module === "user") {
    return <UserSchemaFields fieldMeta={fieldMeta} options={options} setOptions={setOptions} onUpdate={onUpdate} />;
  }

  if (module === "versioncontrol") {
    return <VersionControlSchemaFields fieldMeta={fieldMeta} options={options} onUpdate={onUpdate} />;
  }

  return <GenericKeyValueFields options={options} setOptions={setOptions} />;
}

function UserSchemaFields({
  fieldMeta,
  options,
  setOptions,
  onUpdate
}: {
  fieldMeta: Record<string, FieldMeta>;
  options: Record<string, unknown>;
  setOptions: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  onUpdate: (path: string, value: unknown) => void;
}) {
  const rateLimitPaths = Object.keys(fieldMeta).filter(k => k.startsWith("rateLimits.") && k.endsWith(".limit"));

  const providerVerificationConfig = (options.providerVerificationConfig ?? []) as ProviderItemWithId[];
  const resetPasswordProvider = (options.resetPasswordProvider ?? []) as ProviderItemWithId[];
  const passwordlessLogin = (options.passwordlessLogin ?? {}) as {
    passwordlessLoginProvider?: ProviderItemWithId[];
  };
  const passwordlessProviders = passwordlessLogin.passwordlessLoginProvider ?? [];

  return (
    <>
      {fieldMeta["verificationProcessMaxAttempt"] && (
        <NumericField
          path="verificationProcessMaxAttempt"
          meta={fieldMeta["verificationProcessMaxAttempt"]}
          options={options}
          onUpdate={onUpdate}
        />
      )}

      {rateLimitPaths.map(limitPath => {
        const meta = fieldMeta[limitPath];
        if (!meta) return null;
        return (
          <NumericField
            key={limitPath}
            path={limitPath}
            meta={meta}
            options={options}
            onUpdate={onUpdate}
            emptyValue=""
          />
        );
      })}

      {fieldMeta["providerVerificationConfig"] && (
        <ArrayProviderField
          path="providerVerificationConfig"
          meta={fieldMeta["providerVerificationConfig"]}
          items={providerVerificationConfig}
          setOptions={setOptions}
          strategyOptions={STRATEGY_OPTIONS}
        />
      )}

      {fieldMeta["passwordlessLogin.passwordlessLoginProvider"] && (
        <ArrayProviderField
          path="passwordlessLogin.passwordlessLoginProvider"
          meta={fieldMeta["passwordlessLogin.passwordlessLoginProvider"]}
          items={passwordlessProviders}
          setOptions={setOptions}
          strategyOptions={[]}
        />
      )}

      {fieldMeta["resetPasswordProvider"] && (
        <ArrayProviderField
          path="resetPasswordProvider"
          meta={fieldMeta["resetPasswordProvider"]}
          items={resetPasswordProvider}
          setOptions={setOptions}
          strategyOptions={[]}
        />
      )}
    </>
  );
}

function VersionControlSchemaFields({
  fieldMeta,
  options,
  onUpdate
}: {
  fieldMeta: Record<string, FieldMeta>;
  options: Record<string, unknown>;
  onUpdate: (path: string, value: unknown) => void;
}) {
  const booleanPaths = Object.keys(fieldMeta);

  return (
    <>
      {booleanPaths.map(path => {
        const meta = fieldMeta[path];
        if (!meta) return null;
        return (
          <BooleanField key={path} path={path} meta={meta} options={options} onUpdate={onUpdate} />
        );
      })}
    </>
  );
}

export default ConfigModule;
