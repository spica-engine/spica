import React, {useCallback, useMemo, useState} from "react";
import {useParams} from "react-router-dom";
import {Button, Checkbox, FlexElement, Icon, Select, StringInput, Text} from "oziko-ui-kit";
import isEqual from "lodash/isEqual";
import Page from "../../components/organisms/page-layout/Page";
import {useUpdateConfigMutation} from "../../store/api/configApi";
import {configSchemas, type FieldMeta} from "./schemas";
import styles from "./ConfigModule.module.scss";

type RateLimitValue = number | "";
type ProviderItem = {provider: string; strategy: string};
type ProviderItemWithId = ProviderItem & {_id: string};

let _nextId = 0;
function genId(): string {
  return `_pid_${_nextId++}`;
}

function withIds(items: ProviderItem[]): ProviderItemWithId[] {
  return items.map(item => ({...item, _id: genId()}));
}

function stripIds(items: ProviderItemWithId[]): ProviderItem[] {
  return items.map(({_id, ...rest}) => rest);
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): Record<string, unknown> {
  const keys = path.split(".");
  const result = JSON.parse(JSON.stringify(obj)) as Record<string, unknown>;
  let current: Record<string, unknown> = result;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]] || typeof current[keys[i]] !== "object") {
      current[keys[i]] = {};
    }
    current = current[keys[i]] as Record<string, unknown>;
  }
  current[keys[keys.length - 1]] = value;
  return result;
}

function prepareOptions(options: Record<string, unknown>): Record<string, unknown> {
  const opts = JSON.parse(JSON.stringify(options)) as Record<string, unknown>;
  if (Array.isArray(opts.providerVerificationConfig)) {
    opts.providerVerificationConfig = withIds(opts.providerVerificationConfig as ProviderItem[]);
  }
  if (Array.isArray(opts.resetPasswordProvider)) {
    opts.resetPasswordProvider = withIds(opts.resetPasswordProvider as ProviderItem[]);
  }
  const pl = opts.passwordlessLogin as {passwordlessLoginProvider?: ProviderItem[]} | undefined;
  if (pl && Array.isArray(pl.passwordlessLoginProvider)) {
    opts.passwordlessLogin = {...pl, passwordlessLoginProvider: withIds(pl.passwordlessLoginProvider)};
  }
  return opts;
}

function sanitizeForSave(options: Record<string, unknown>): Record<string, unknown> {
  const result = JSON.parse(JSON.stringify(options)) as Record<string, unknown>;

  if (Array.isArray(result.providerVerificationConfig)) {
    result.providerVerificationConfig = stripIds(
      result.providerVerificationConfig as ProviderItemWithId[]
    );
  }
  if (Array.isArray(result.resetPasswordProvider)) {
    result.resetPasswordProvider = stripIds(
      result.resetPasswordProvider as ProviderItemWithId[]
    );
  }
  const pl = result.passwordlessLogin as {
    passwordlessLoginProvider?: ProviderItemWithId[];
  } | undefined;
  if (pl && Array.isArray(pl.passwordlessLoginProvider)) {
    result.passwordlessLogin = {
      ...pl,
      passwordlessLoginProvider: stripIds(pl.passwordlessLoginProvider)
    };
  }

  if (result.rateLimits && typeof result.rateLimits === "object") {
    const rawRl = result.rateLimits as Record<string, {limit: RateLimitValue; ttl: RateLimitValue}>;
    const cleanRl: Record<string, {limit: number; ttl: number}> = {};
    for (const [cat, rl] of Object.entries(rawRl)) {
      const limitEmpty = rl.limit === "" || rl.limit === 0;
      const ttlEmpty = rl.ttl === "" || rl.ttl === 0;
      if (limitEmpty && ttlEmpty) continue;
      cleanRl[cat] = {
        limit: typeof rl.limit === "number" ? rl.limit : 0,
        ttl: typeof rl.ttl === "number" ? rl.ttl : 0
      };
    }
    if (Object.keys(cleanRl).length === 0) {
      delete result.rateLimits;
    } else {
      result.rateLimits = cleanRl;
    }
  }

  return result;
}

const PROVIDER_OPTIONS = [
  {label: "email", value: "email"},
  {label: "phone", value: "phone"}
];

const STRATEGY_OPTIONS = [
  {label: "Otp", value: "Otp"},
  {label: "MagicLink", value: "MagicLink"}
];

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

function RateLimitField({
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
  const currentValue = (getNestedValue(options, path) as RateLimitValue) ?? "";

  const handleChange = (v: string) => {
    if (v === "") {
      onUpdate(path, "");
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
          value={currentValue === "" ? "" : String(currentValue)}
          onChange={handleChange}
          unit={meta.unit}
          placeholder="0"
        />
      </div>
    </div>
  );
}

function BooleanField({
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

function IntegerField({
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
  const currentValue = getNestedValue(options, path);
  const displayValue = currentValue === undefined || currentValue === null ? "" : String(currentValue);

  const handleChange = (v: string) => {
    if (v === "") {
      onUpdate(path, 0);
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
    setOptions(prev => {
      const pathParts = path.split(".");
      if (pathParts.length === 1) {
        const list = [...((prev[path] ?? []) as ProviderItemWithId[])];
        list[index] = {...list[index], [field]: value};
        return {...prev, [path]: list};
      }
      const parent = pathParts[0];
      const child = pathParts[1];
      const parentObj = (prev[parent] ?? {}) as Record<string, unknown>;
      const list = [...((parentObj[child] ?? []) as ProviderItemWithId[])];
      list[index] = {...list[index], [field]: value};
      return {...prev, [parent]: {...parentObj, [child]: list}};
    });
  };

  const addItem = () => {
    setOptions(prev => {
      const newItem: ProviderItemWithId = {provider: "email", strategy: strategyOptions[0]?.value ?? "", _id: genId()};
      const pathParts = path.split(".");
      if (pathParts.length === 1) {
        return {...prev, [path]: [...((prev[path] ?? []) as ProviderItemWithId[]), newItem]};
      }
      const parent = pathParts[0];
      const child = pathParts[1];
      const parentObj = (prev[parent] ?? {}) as Record<string, unknown>;
      return {...prev, [parent]: {...parentObj, [child]: [...((parentObj[child] ?? []) as ProviderItemWithId[]), newItem]}};
    });
  };

  const removeItem = (index: number) => {
    setOptions(prev => {
      const pathParts = path.split(".");
      if (pathParts.length === 1) {
        return {...prev, [path]: ((prev[path] ?? []) as ProviderItemWithId[]).filter((_, i) => i !== index)};
      }
      const parent = pathParts[0];
      const child = pathParts[1];
      const parentObj = (prev[parent] ?? {}) as Record<string, unknown>;
      return {...prev, [parent]: {...parentObj, [child]: ((parentObj[child] ?? []) as ProviderItemWithId[]).filter((_, i) => i !== index)}};
    });
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
        <IntegerField
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
          <RateLimitField
            key={limitPath}
            path={limitPath}
            meta={meta}
            options={options}
            onUpdate={onUpdate}
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
