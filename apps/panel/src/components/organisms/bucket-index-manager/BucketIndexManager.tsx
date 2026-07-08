import {memo, useCallback, useEffect, useMemo, useState} from "react";
import {Button, Checkbox, Drawer, Icon, NumberInput, StringInput} from "oziko-ui-kit";
import styles from "./BucketIndexManager.module.scss";
import {
  useUpdateBucketMutation,
  type BucketType,
  type Properties
} from "../../../store/api/bucketApi";

// oziko <Drawer size> is a raw px number with no design token; mirrors BucketEntryDrawer's width.
const DRAWER_WIDTH_PX = 475;

// Depth guard so a self-referential/object-heavy schema can't produce an unbounded suggestion list.
const MAX_SUGGESTION_DEPTH = 3;

// Mongo wildcard key — indexes every field under a path (or the whole document with a bare "$**").
const WILDCARD_TOKEN = "$**";

type IndexKind = "1" | "-1" | "text" | "2dsphere" | "2d" | "hashed";

type FieldRow = {
  id: string;
  path: string;
  kind: IndexKind;
};

type FormMode = "form" | "raw";

type IndexEntry = NonNullable<BucketType["indexes"]>[number];

const KIND_OPTIONS: {value: IndexKind; label: string}[] = [
  {value: "1", label: "Ascending (1)"},
  {value: "-1", label: "Descending (-1)"},
  {value: "text", label: "Text"},
  {value: "2dsphere", label: "2dsphere"},
  {value: "2d", label: "2d"},
  {value: "hashed", label: "Hashed"}
];

// strength 1/2 give the case-insensitive collations users usually want.
const STRENGTH_OPTIONS: {value: number; label: string}[] = [
  {value: 1, label: "1 — case & diacritic insensitive"},
  {value: 2, label: "2 — case insensitive"},
  {value: 3, label: "3 — case sensitive (default)"},
  {value: 4, label: "4"},
  {value: 5, label: "5"}
];

let rowSeq = 0;
const createEmptyRow = (kind: IndexKind = "1", path = ""): FieldRow => ({
  id: `row-${rowSeq++}`,
  path,
  kind
});

const kindToDefValue = (kind: IndexKind): number | string =>
  kind === "1" ? 1 : kind === "-1" ? -1 : kind;

const collectSuggestions = (
  properties: Properties | undefined,
  prefix = "",
  depth = 0
): string[] => {
  if (!properties) return [];

  return Object.entries(properties).flatMap(([key, property]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    const isObject = property?.type === "object" && (property as any).properties;
    if (isObject && depth < MAX_SUGGESTION_DEPTH) {
      return [path, ...collectSuggestions((property as any).properties, path, depth + 1)];
    }
    return [path];
  });
};

const formatDefinition = (definition: IndexEntry["definition"]): string =>
  Object.entries(definition)
    .map(([key, value]) => {
      if (value === 1) return `${key}: ↑`;
      if (value === -1) return `${key}: ↓`;
      return `${key}: ${value}`;
    })
    .join("   ·   ");

const buildBadges = (entry: IndexEntry): string[] => {
  const badges: string[] = [];
  const options = entry.options ?? {};
  if (options.name) badges.push(String(options.name));
  if (options.unique) badges.push("Unique");
  if (options.sparse) badges.push("Sparse");
  if (options.expireAfterSeconds != null) badges.push(`TTL ${options.expireAfterSeconds}s`);
  if (options.partialFilterExpression) badges.push("Partial");
  if (options.collation) badges.push("Collation");
  if (options.weights) badges.push("Weights");

  const keys = Object.keys(entry.definition ?? {});
  const values = Object.values(entry.definition ?? {});
  if (keys.some(key => key.includes(WILDCARD_TOKEN))) badges.push("Wildcard");
  if (values.includes("text")) badges.push("Text");
  if (values.includes("2dsphere")) badges.push("Geo");
  if (values.includes("2d")) badges.push("2d");
  if (values.includes("hashed")) badges.push("Hashed");

  return badges;
};

const isPlainObject = (value: unknown): value is Record<string, any> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const resolveErrorMessage = (error: unknown): string | null => {
  if (!error) return null;
  if (typeof error === "object" && error !== null && "status" in error) {
    const data = (error as any).data;
    if (typeof data === "string") return data;
    return data?.message || "Failed to save indexes.";
  }
  return (error as any)?.message || "Failed to save indexes.";
};

export interface BucketIndexManagerProps {
  bucket: BucketType;
  isOpen: boolean;
  onClose: () => void;
}

const BucketIndexManager = ({bucket, isOpen, onClose}: BucketIndexManagerProps) => {
  const [updateBucket, {isLoading, error, reset}] = useUpdateBucketMutation();

  const [workingIndexes, setWorkingIndexes] = useState<IndexEntry[]>([]);
  const [mode, setMode] = useState<FormMode>("form");

  const [rows, setRows] = useState<FieldRow[]>([createEmptyRow()]);
  const [unique, setUnique] = useState(false);
  const [sparse, setSparse] = useState(false);
  const [ttl, setTtl] = useState<number | null>(null);
  const [customName, setCustomName] = useState("");
  const [partialText, setPartialText] = useState("");
  const [collationEnabled, setCollationEnabled] = useState(false);
  const [collationLocale, setCollationLocale] = useState("en");
  const [collationStrength, setCollationStrength] = useState(2);
  const [defaultLanguage, setDefaultLanguage] = useState("");
  const [weightByRow, setWeightByRow] = useState<Record<string, number | null>>({});
  const [rawText, setRawText] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setMode("form");
    setRows([createEmptyRow()]);
    setUnique(false);
    setSparse(false);
    setTtl(null);
    setCustomName("");
    setPartialText("");
    setCollationEnabled(false);
    setCollationLocale("en");
    setCollationStrength(2);
    setDefaultLanguage("");
    setWeightByRow({});
    setRawText("");
    setFormError(null);
  }, []);

  // Re-sync the staged copy every time the drawer opens so it reflects indexes
  // written elsewhere (e.g. the per-field "Indexed" toggle) without a full unmount.
  useEffect(() => {
    if (isOpen) {
      setWorkingIndexes(bucket.indexes ? [...bucket.indexes] : []);
      resetForm();
      reset();
    }
  }, [isOpen, bucket.indexes, resetForm, reset]);

  const suggestions = useMemo(
    () => ["_id", WILDCARD_TOKEN, ...collectSuggestions(bucket.properties)],
    [bucket.properties]
  );

  const handlePathChange = useCallback((id: string, path: string) => {
    setRows(prev => prev.map(row => (row.id === id ? {...row, path} : row)));
  }, []);

  const handleKindChange = useCallback((id: string, kind: IndexKind) => {
    setRows(prev => prev.map(row => (row.id === id ? {...row, kind} : row)));
  }, []);

  const handleAddRow = useCallback(() => {
    setRows(prev => [...prev, createEmptyRow()]);
  }, []);

  const handleAddWildcardRow = useCallback(() => {
    setRows(prev => [...prev, createEmptyRow("1", WILDCARD_TOKEN)]);
  }, []);

  const handleRemoveRow = useCallback((id: string) => {
    setRows(prev => (prev.length > 1 ? prev.filter(row => row.id !== id) : prev));
  }, []);

  const handleWeightChange = useCallback((id: string, value: number | null) => {
    setWeightByRow(prev => ({...prev, [id]: value}));
  }, []);

  const handleDeleteIndex = useCallback((index: number) => {
    setWorkingIndexes(prev => prev.filter((_, i) => i !== index));
  }, []);

  const textRows = useMemo(
    () => rows.filter(row => row.kind === "text" && row.path.trim() !== ""),
    [rows]
  );

  const buildFormEntry = useCallback((): {entry?: IndexEntry; error?: string} => {
    const validRows = rows.filter(row => row.path.trim() !== "");
    if (validRows.length === 0) return {error: "Add at least one field with a path."};

    const definition = validRows.reduce<IndexEntry["definition"]>((acc, row) => {
      acc[row.path.trim()] = kindToDefValue(row.kind);
      return acc;
    }, {});

    const options: Record<string, any> = {};
    if (unique) options.unique = true;
    if (sparse) options.sparse = true;
    if (ttl != null && Number.isFinite(ttl) && ttl >= 0) options.expireAfterSeconds = ttl;
    if (customName.trim()) options.name = customName.trim();

    if (partialText.trim()) {
      try {
        const parsed = JSON.parse(partialText);
        if (!isPlainObject(parsed)) return {error: "Partial filter must be a JSON object."};
        options.partialFilterExpression = parsed;
      } catch {
        return {error: "Partial filter is not valid JSON."};
      }
    }

    if (collationEnabled) {
      if (!collationLocale.trim()) return {error: "Collation requires a locale."};
      options.collation = {locale: collationLocale.trim(), strength: collationStrength};
    }

    if (validRows.some(row => row.kind === "text")) {
      if (defaultLanguage.trim()) options.default_language = defaultLanguage.trim();
      const weights = validRows.reduce<Record<string, number>>((acc, row) => {
        const weight = weightByRow[row.id];
        if (row.kind === "text" && weight != null && Number.isFinite(weight) && weight > 0) {
          acc[row.path.trim()] = weight;
        }
        return acc;
      }, {});
      if (Object.keys(weights).length > 0) options.weights = weights;
    }

    const entry: IndexEntry =
      Object.keys(options).length > 0 ? {definition, options} : {definition};
    return {entry};
  }, [
    rows,
    unique,
    sparse,
    ttl,
    customName,
    partialText,
    collationEnabled,
    collationLocale,
    collationStrength,
    defaultLanguage,
    weightByRow
  ]);

  const buildRawEntry = useCallback((): {entry?: IndexEntry; error?: string} => {
    if (!rawText.trim()) return {error: "Paste a JSON index definition."};

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return {error: "Raw index is not valid JSON."};
    }
    if (!isPlainObject(parsed)) return {error: "Expected a JSON object."};

    const hasWrapper = isPlainObject(parsed.definition);
    const definition = hasWrapper ? parsed.definition : parsed;
    const rawOptions = hasWrapper ? parsed.options : undefined;

    if (!isPlainObject(definition) || Object.keys(definition).length === 0) {
      return {error: "Missing a non-empty 'definition' object."};
    }
    if (rawOptions !== undefined && !isPlainObject(rawOptions)) {
      return {error: "'options' must be a JSON object."};
    }

    const entry: IndexEntry =
      rawOptions && Object.keys(rawOptions).length > 0
        ? {definition: definition as IndexEntry["definition"], options: rawOptions}
        : {definition: definition as IndexEntry["definition"]};
    return {entry};
  }, [rawText]);

  const handleAddIndex = useCallback(() => {
    const {entry, error: buildError} = mode === "raw" ? buildRawEntry() : buildFormEntry();
    if (buildError || !entry) {
      setFormError(buildError ?? "Unable to build index.");
      return;
    }
    setWorkingIndexes(prev => [...prev, entry]);
    setRows([createEmptyRow()]);
    setUnique(false);
    setSparse(false);
    setTtl(null);
    setCustomName("");
    setPartialText("");
    setCollationEnabled(false);
    setDefaultLanguage("");
    setWeightByRow({});
    setRawText("");
    setFormError(null);
  }, [mode, buildRawEntry, buildFormEntry]);

  const handleSave = useCallback(async () => {
    const {section, index, ...rest} = bucket as Record<string, any>;
    try {
      await updateBucket({
        id: bucket._id,
        body: {...rest, indexes: workingIndexes}
      }).unwrap();
      onClose();
    } catch {
      // Error surfaced through the RTK Query `error` state below.
    }
  }, [bucket, workingIndexes, updateBucket, onClose]);

  const errorMessage = useMemo(() => resolveErrorMessage(error), [error]);

  return (
    <Drawer
      placement="right"
      showCloseButton={false}
      isOpen={isOpen}
      onClose={onClose}
      size={DRAWER_WIDTH_PX}
    >
      <div className={styles.bucketIndexManager}>
        <div className={styles.header}>
          <div className={styles.headerInfo}>
            <div className={styles.title}>Manage Indexes</div>
            <div className={styles.subtitle}>{bucket.title}&nbsp;·&nbsp;MongoDB indexes</div>
          </div>
          <button className={styles.close} onClick={onClose} aria-label="Close">
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={styles.body}>
          <section className={styles.section}>
            <div className={styles.sectionTitle}>Current indexes</div>
            {workingIndexes.length === 0 ? (
              <div className={styles.empty}>No custom indexes yet.</div>
            ) : (
              <ul className={styles.indexList}>
                {workingIndexes.map((entry, i) => (
                  <li key={i} className={styles.indexItem}>
                    <div className={styles.indexInfo}>
                      <span className={styles.indexKeys}>{formatDefinition(entry.definition)}</span>
                      {buildBadges(entry).length > 0 && (
                        <div className={styles.badges}>
                          {buildBadges(entry).map(badge => (
                            <span key={badge} className={styles.badge}>
                              {badge}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      className={styles.deleteButton}
                      onClick={() => handleDeleteIndex(i)}
                      aria-label="Delete index"
                    >
                      <Icon name="close" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={styles.section}>
            <div className={styles.sectionTitle}>Add index</div>

            <div className={styles.modeTabs}>
              <button
                className={mode === "form" ? styles.modeTabActive : styles.modeTab}
                onClick={() => setMode("form")}
              >
                Form
              </button>
              <button
                className={mode === "raw" ? styles.modeTabActive : styles.modeTab}
                onClick={() => setMode("raw")}
              >
                Raw JSON
              </button>
            </div>

            {mode === "form" ? (
              <>
                <div className={styles.fieldRows}>
                  {rows.map(row => (
                    <div key={row.id} className={styles.fieldRow}>
                      <StringInput
                        className={styles.pathInput}
                        options={suggestions}
                        value={row.path}
                        onChange={value => handlePathChange(row.id, value)}
                        inputProps={{placeholder: "field, nested.path, or $**"}}
                      />
                      <select
                        className={styles.kindSelect}
                        value={row.kind}
                        onChange={e => handleKindChange(row.id, e.target.value as IndexKind)}
                      >
                        {KIND_OPTIONS.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <button
                        className={styles.removeRow}
                        onClick={() => handleRemoveRow(row.id)}
                        disabled={rows.length <= 1}
                        aria-label="Remove field"
                      >
                        <Icon name="minus" />
                      </button>
                    </div>
                  ))}
                  <div className={styles.rowActions}>
                    <Button variant="text" color="default" onClick={handleAddRow}>
                      <Icon name="plus" />
                      Field
                    </Button>
                    <Button variant="text" color="default" onClick={handleAddWildcardRow}>
                      <Icon name="plus" />
                      Wildcard
                    </Button>
                  </div>
                </div>

                <div className={styles.optionsGrid}>
                  <div className={styles.checkRow}>
                    <Checkbox
                      label="Unique"
                      checked={unique}
                      onChange={e => setUnique(e.target.checked)}
                    />
                    <Checkbox
                      label="Sparse"
                      checked={sparse}
                      onChange={e => setSparse(e.target.checked)}
                    />
                  </div>

                  <div className={styles.inlineField}>
                    <span className={styles.fieldLabel}>TTL (seconds)</span>
                    <NumberInput
                      className={styles.numberInput}
                      value={ttl ?? undefined}
                      onChange={value =>
                        setTtl(value == null || Number.isNaN(value) ? null : value)
                      }
                      inputProps={{placeholder: "off"}}
                    />
                  </div>

                  <div className={styles.inlineField}>
                    <span className={styles.fieldLabel}>Custom name</span>
                    <StringInput
                      className={styles.textInput}
                      value={customName}
                      onChange={setCustomName}
                      inputProps={{placeholder: "auto"}}
                    />
                  </div>

                  <div className={styles.stackedField}>
                    <span className={styles.fieldLabel}>Partial filter (JSON)</span>
                    <textarea
                      className={styles.textarea}
                      value={partialText}
                      onChange={e => setPartialText(e.target.value)}
                      placeholder={'{ "status": "active" }'}
                      rows={2}
                      spellCheck={false}
                    />
                  </div>

                  <div className={styles.collationBlock}>
                    <Checkbox
                      label="Collation (case-insensitive)"
                      checked={collationEnabled}
                      onChange={e => setCollationEnabled(e.target.checked)}
                    />
                    {collationEnabled && (
                      <div className={styles.collationInputs}>
                        <StringInput
                          className={styles.textInput}
                          value={collationLocale}
                          onChange={setCollationLocale}
                          inputProps={{placeholder: "locale, e.g. en"}}
                        />
                        <select
                          className={styles.kindSelect}
                          value={collationStrength}
                          onChange={e => setCollationStrength(Number(e.target.value))}
                        >
                          {STRENGTH_OPTIONS.map(option => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {textRows.length > 0 && (
                    <div className={styles.textBlock}>
                      <span className={styles.fieldLabel}>Text options</span>
                      <StringInput
                        className={styles.textInput}
                        value={defaultLanguage}
                        onChange={setDefaultLanguage}
                        inputProps={{placeholder: "default_language, e.g. english"}}
                      />
                      {textRows.map(row => (
                        <div key={row.id} className={styles.weightRow}>
                          <span className={styles.weightLabel}>{row.path.trim()}</span>
                          <NumberInput
                            className={styles.numberInput}
                            value={weightByRow[row.id] ?? undefined}
                            onChange={value =>
                              handleWeightChange(
                                row.id,
                                value == null || Number.isNaN(value) ? null : value
                              )
                            }
                            inputProps={{placeholder: "weight"}}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className={styles.stackedField}>
                <span className={styles.fieldLabel}>
                  Paste {"{ definition, options }"} — covers any index type
                </span>
                <textarea
                  className={styles.rawTextarea}
                  value={rawText}
                  onChange={e => setRawText(e.target.value)}
                  placeholder={'{\n  "definition": { "location": "2dsphere" },\n  "options": { "name": "geo_idx" }\n}'}
                  rows={7}
                  spellCheck={false}
                />
              </div>
            )}

            {formError && <div className={styles.formError}>{formError}</div>}

            <Button className={styles.addIndexButton} onClick={handleAddIndex}>
              <Icon name="plus" />
              Add index
            </Button>
          </section>
        </div>

        <div className={styles.footer}>
          {errorMessage && <div className={styles.error}>{errorMessage}</div>}
          <div className={styles.footerActions}>
            <Button variant="outlined" color="default" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={isLoading}>
              <Icon name="check" />
              Save
            </Button>
          </div>
        </div>
      </div>
    </Drawer>
  );
};

export default memo(BucketIndexManager);
