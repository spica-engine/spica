/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import {memo, useCallback} from "react";
import {useCopyToClipboard} from "../../../hooks/useCopyToClipboard";
import {Button, FlexElement, Icon, Input, Select, Switch} from "oziko-ui-kit";
import PanelAccordion, {
  PanelAccordionItem
} from "../../../components/molecules/panel-accordion/PanelAccordion";
import JsonFieldInput from "../../../components/molecules/json-field-input/JsonFieldInput";
import type {FunctionTrigger, Enqueuer} from "../../../store/api/functionApi";
import styles from "./TriggerPanel.module.scss";

type TriggerPanelProps = {
  triggers: FunctionTrigger[];
  enqueuers: Enqueuer[];
  handlers: string[];
  onChange: (triggers: FunctionTrigger[]) => void;
};

// Types the panel knows how to build dedicated fields for, in the order they should be offered.
// Anything the backend reports that isn't in here (a future enqueuer, or one the panel hasn't
// caught up with yet, e.g. gRPC) still gets listed and gets a raw JSON options editor as a
// fallback, instead of being hidden — see the DEFAULT case in the trigger body below.
const KNOWN_TRIGGER_TYPES = [
  "http",
  "firehose",
  "database",
  "schedule",
  "system",
  "bucket",
  "rabbitmq"
];

const HTTP_METHODS = ["All", "Get", "Post", "Put", "Delete", "Patch", "Head"];
const AUTH_STRATEGIES = ["IDENTITY", "APIKEY", "USER"];
const DB_OPERATIONS = ["INSERT", "UPDATE", "REPLACE", "DELETE"];
const BUCKET_OPERATIONS = ["ALL", "INSERT", "UPDATE", "DELETE"];
const SYSTEM_EVENTS = ["READY"];

const DEFAULT_OPTIONS_BY_TYPE: Record<string, Record<string, any>> = {
  http: {method: "All"},
  rabbitmq: {url: "", queue: {name: "", durable: false}, noAck: true}
};

const BASE_URL = (import.meta.env.VITE_BASE_URL as string) || "";

function removeBindingAt<T>(list: T[] | undefined, bindingIndex: number): T[] {
  return (list ?? []).filter((_, i) => i !== bindingIndex);
}

function updateBindingAt<T>(list: T[] | undefined, bindingIndex: number, patch: Partial<T>): T[] {
  return (list ?? []).map((binding, i) => (i === bindingIndex ? {...binding, ...patch} : binding));
}

const TriggerPanel = ({triggers, enqueuers, handlers, onChange}: TriggerPanelProps) => {
  const handleAddTrigger = useCallback(() => {
    const newTrigger: FunctionTrigger = {
      type: "http",
      options: {method: "All"}
    };
    onChange([...triggers, newTrigger]);
  }, [triggers, onChange]);

  const handleDeleteTrigger = useCallback(
    (index: number) => {
      onChange(triggers.filter((_, i) => i !== index));
    },
    [triggers, onChange]
  );

  const handleTypeChange = useCallback(
    (index: number, type: FunctionTrigger["type"]) => {
      onChange(
        triggers.map((t, i) =>
          i === index ? {...t, type, options: DEFAULT_OPTIONS_BY_TYPE[type] ?? {}} : t
        )
      );
    },
    [triggers, onChange]
  );

  const handleHandlerChange = useCallback(
    (index: number, handler: string) => {
      onChange(
        triggers.map((t, i) => {
          if (i !== index) return t;
          const options = t.type === "http" ? {...t.options, path: `/${handler}`} : t.options;
          return {...t, handler, options};
        })
      );
    },
    [triggers, onChange]
  );

  const handleOptionChange = useCallback(
    (index: number, key: string, value: any) => {
      onChange(
        triggers.map((t, i) => (i === index ? {...t, options: {...t.options, [key]: value}} : t))
      );
    },
    [triggers, onChange]
  );

  // Sets a field one level down (options.queue.durable, options.consume.priority, ...) without
  // disturbing the rest of that section.
  const handleSectionFieldChange = useCallback(
    (index: number, section: string, field: string, value: any) => {
      onChange(
        triggers.map((t, i) => {
          if (i !== index) return t;
          const current = t.options[section] ?? {};
          return {...t, options: {...t.options, [section]: {...current, [field]: value}}};
        })
      );
    },
    [triggers, onChange]
  );

  // For a type the panel has no dedicated fields for: the JSON editor owns the whole
  // options object, not just one key of it.
  const handleReplaceOptions = useCallback(
    (index: number, options: Record<string, any>) => {
      onChange(triggers.map((t, i) => (i === index ? {...t, options} : t)));
    },
    [triggers, onChange]
  );

  const handleToggleStrategy = useCallback(
    (index: number, strategy: string) => {
      onChange(
        triggers.map((t, i) => {
          if (i !== index) return t;
          const current: string[] = t.options.authenticate ?? [];
          const next = current.includes(strategy)
            ? current.filter(s => s !== strategy)
            : [...current, strategy];
          return {...t, options: {...t.options, authenticate: next}};
        })
      );
    },
    [triggers, onChange]
  );

  const handleToggleRateLimit = useCallback(
    (index: number, enabled: boolean) => {
      onChange(
        triggers.map((t, i) => {
          if (i !== index) return t;
          if (enabled) {
            return {...t, options: {...t.options, rateLimit: {limit: 100, ttl: 60000}}};
          }
          const {rateLimit, ...rest} = t.options;
          return {...t, options: rest};
        })
      );
    },
    [triggers, onChange]
  );

  const handleRateLimitField = useCallback(
    (index: number, field: "limit" | "ttl", raw: string) => {
      const parsed = Number(raw);
      onChange(
        triggers.map((t, i) => {
          if (i !== index) return t;
          const current = t.options.rateLimit ?? {limit: 100, ttl: 60000};
          const value = Number.isNaN(parsed) ? current[field] : parsed;
          return {...t, options: {...t.options, rateLimit: {...current, [field]: value}}};
        })
      );
    },
    [triggers, onChange]
  );

  // Shared by the exchange toggle and the two binding lists: enabling adds a starter shape,
  // disabling drops the key entirely rather than leaving an empty object/array behind.
  const handleToggleSection = useCallback(
    (index: number, section: string, enabled: boolean, starter: any) => {
      onChange(
        triggers.map((t, i) => {
          if (i !== index) return t;
          if (enabled) {
            return {...t, options: {...t.options, [section]: starter}};
          }
          const {[section]: _removed, ...rest} = t.options;
          return {...t, options: rest};
        })
      );
    },
    [triggers, onChange]
  );

  const handleAddBinding = useCallback(
    (index: number, section: "bindings" | "exchangeBindings", starter: any) => {
      onChange(
        triggers.map((t, i) =>
          i === index
            ? {...t, options: {...t.options, [section]: [...(t.options[section] ?? []), starter]}}
            : t
        )
      );
    },
    [triggers, onChange]
  );

  const handleBindingFieldChange = useCallback(
    (
      index: number,
      section: "bindings" | "exchangeBindings",
      bindingIndex: number,
      field: string,
      value: any
    ) => {
      onChange(
        triggers.map((t, i) =>
          i === index
            ? {
                ...t,
                options: {
                  ...t.options,
                  [section]: updateBindingAt(t.options[section], bindingIndex, {[field]: value})
                }
              }
            : t
        )
      );
    },
    [triggers, onChange]
  );

  const handleRemoveBinding = useCallback(
    (index: number, section: "bindings" | "exchangeBindings", bindingIndex: number) => {
      onChange(
        triggers.map((t, i) =>
          i === index
            ? {
                ...t,
                options: {
                  ...t.options,
                  [section]: removeBindingAt(t.options[section], bindingIndex)
                }
              }
            : t
        )
      );
    },
    [triggers, onChange]
  );

  const handleActiveChange = useCallback(
    (index: number, active: boolean) => {
      onChange(triggers.map((t, i) => (i === index ? {...t, active} : t)));
    },
    [triggers, onChange]
  );

  const {copied: urlCopied, copy: copyUrl} = useCopyToClipboard();

  // The dropdown lists whatever the backend actually registered, so a type the panel has no
  // dedicated UI for (a custom enqueuer, gRPC today) is still selectable — it falls back to a
  // raw JSON options editor instead of vanishing. See the DEFAULT branch below.
  const typeOptions = enqueuers
    .map(e => e.description.name)
    .sort((a, b) => {
      const ai = KNOWN_TRIGGER_TYPES.indexOf(a);
      const bi = KNOWN_TRIGGER_TYPES.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    })
    .map(name => ({
      label: enqueuers.find(e => e.description.name === name)?.description.title ?? name,
      value: name
    }));

  const methodOptions = HTTP_METHODS.map(m => ({label: m, value: m}));
  const operationOptions = DB_OPERATIONS.map(op => ({label: op, value: op}));
  const bucketOperationOptions = BUCKET_OPERATIONS.map(op => ({label: op, value: op}));
  const systemEventOptions = SYSTEM_EVENTS.map(ev => ({label: ev, value: ev}));

  const getEnqueuerPropertyOptions = useCallback(
    (type: string, property: string) => {
      const enqueuer = enqueuers.find(e => e.description.name === type);
      const prop = enqueuer?.options?.properties?.[property] as any;
      if (!prop?.enum) return [];
      const viewEnum = prop.viewEnum as string[] | undefined;
      return prop.enum.map((val: string, i: number) => ({
        label: viewEnum?.[i] ?? val,
        value: val
      }));
    },
    [enqueuers]
  );

  const triggerItems = triggers.map((trigger, index) => {
    const handlerOptions = handlers.map(h => ({
      label: h,
      value: h,
      disabled: triggers.some((t, ti) => ti !== index && t.handler === h)
    }));

    return (
      <PanelAccordionItem
        key={`trigger-${index}`}
        variant="row"
        bodyClassName={styles.triggerRowBody}
        header={
          <span className={trigger.handler ? styles.handlerName : styles.handlerPlaceholder}>
            {trigger.handler ?? "No handler assigned"}
          </span>
        }
        actions={
          <>
            <button
              type="button"
              className={`${styles.triggerToggle} ${trigger.active !== false ? styles.triggerToggleOn : ""}`}
              aria-pressed={trigger.active !== false}
              aria-label={trigger.active !== false ? "Disable trigger" : "Enable trigger"}
              onClick={() => handleActiveChange(index, trigger.active === false)}
            />
            <button
              type="button"
              className={styles.triggerDeleteButton}
              aria-label="Delete trigger"
              onClick={() => handleDeleteTrigger(index)}
            >
              <svg
                width="11"
                height="11"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              </svg>
            </button>
          </>
        }
      >
        <FlexElement
          direction="vertical"
          dimensionX="fill"
          gap={12}
          className={styles.triggerItemContent}
        >
          <div className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>Handler</span>
            <Select
              options={handlerOptions}
              value={trigger.handler ?? ""}
              onChange={value => handleHandlerChange(index, value as string)}
              dimensionX="fill"
            />
          </div>
          <div className={styles.fieldGroup}>
            <span className={styles.fieldLabel}>Type</span>
            <Select
              options={typeOptions}
              value={trigger.type}
              onChange={value => handleTypeChange(index, value as FunctionTrigger["type"])}
              dimensionX="fill"
            />
          </div>
          {trigger.type === "http" && (
            <>
              <div className={styles.fieldGroup}>
                <span className={styles.fieldLabel}>Method</span>
                <Select
                  options={methodOptions}
                  value={trigger.options.method ?? "All"}
                  onChange={value => handleOptionChange(index, "method", value as string)}
                  dimensionX="fill"
                />
              </div>
              <div className={styles.fieldGroup}>
                <span className={styles.fieldLabel}>Path</span>
                <div className={styles.inputRow}>
                  <div className={styles.inputPrefix}>
                    <Icon name="formatQuoteClose" size="sm" />
                  </div>
                  <input
                    className={styles.pathInput}
                    placeholder="/my-endpoint"
                    value={trigger.options.path ?? ""}
                    onChange={e => handleOptionChange(index, "path", e.target.value)}
                    type="text"
                  />
                </div>
              </div>
              <div className={styles.urlRow}>
                <span className={styles.urlText}>
                  {`${BASE_URL}/fn-execute${trigger.options.path ?? ""}`}
                </span>
                <Button
                  variant="icon"
                  color="default"
                  className={styles.copyAction}
                  onClick={() => copyUrl(`${BASE_URL}/fn-execute${trigger.options.path ?? ""}`)}
                >
                  <Icon name={urlCopied ? "check" : "contentCopy"} size="sm" />
                </Button>
              </div>
              {(() => {
                const preflight = trigger.options.preflight !== false;
                const authenticate: string[] = trigger.options.authenticate ?? [];
                const authorize = trigger.options.authorize ?? false;
                const rateLimit = trigger.options.rateLimit;
                return (
                  <>
                    <div className={styles.fieldGroup}>
                      <div className={styles.optionRow}>
                        <span className={styles.fieldLabel}>Preflight (CORS)</span>
                        <Switch
                          checked={preflight}
                          size="small"
                          onChange={checked => handleOptionChange(index, "preflight", checked)}
                        />
                      </div>
                    </div>
                    <div className={styles.fieldGroup}>
                      <span className={styles.fieldLabel}>Authentication Strategies</span>
                      <div className={styles.chipRow}>
                        {AUTH_STRATEGIES.map(strategy => {
                          const selected = authenticate.includes(strategy);
                          return (
                            <button
                              type="button"
                              key={strategy}
                              className={`${styles.optionChip} ${selected ? styles.optionChipOn : ""}`}
                              aria-pressed={selected}
                              onClick={() => handleToggleStrategy(index, strategy)}
                            >
                              {strategy}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className={styles.fieldGroup}>
                      <div className={styles.optionRow}>
                        <span className={styles.fieldLabel}>Authorization</span>
                        <Switch
                          checked={authorize}
                          size="small"
                          onChange={checked => handleOptionChange(index, "authorize", checked)}
                        />
                      </div>
                      {authorize && authenticate.length === 0 && (
                        <span className={styles.fieldWarning}>
                          Select at least one authentication strategy when authorization is enabled.
                        </span>
                      )}
                    </div>
                    <div className={styles.fieldGroup}>
                      <div className={styles.optionRow}>
                        <span className={styles.fieldLabel}>Rate Limit</span>
                        <Switch
                          checked={!!rateLimit}
                          size="small"
                          onChange={checked => handleToggleRateLimit(index, checked)}
                        />
                      </div>
                      {rateLimit && (
                        <div className={styles.rateLimitFields}>
                          <div className={styles.fieldGroup}>
                            <span className={styles.fieldLabel}>Limit</span>
                            <input
                              className={styles.numberInput}
                              type="number"
                              min={1}
                              value={rateLimit.limit}
                              onChange={e => handleRateLimitField(index, "limit", e.target.value)}
                            />
                          </div>
                          <div className={styles.fieldGroup}>
                            <span className={styles.fieldLabel}>TTL (ms)</span>
                            <input
                              className={styles.numberInput}
                              type="number"
                              min={1}
                              value={rateLimit.ttl}
                              onChange={e => handleRateLimitField(index, "ttl", e.target.value)}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </>
          )}
          {trigger.type === "firehose" && (
            <div className={styles.fieldGroup}>
              <span className={styles.fieldLabel}>Event</span>
              <div className={styles.inputRow}>
                <div className={styles.inputPrefix}>
                  <Icon name="formatQuoteClose" size="sm" />
                </div>
                <input
                  className={styles.pathInput}
                  placeholder="* (all), ** (connection), or custom event"
                  value={trigger.options.event ?? ""}
                  onChange={e => handleOptionChange(index, "event", e.target.value)}
                  type="text"
                />
              </div>
            </div>
          )}
          {trigger.type === "database" && (
            <>
              <div className={styles.fieldGroup}>
                <span className={styles.fieldLabel}>Collection</span>
                <Select
                  options={getEnqueuerPropertyOptions("database", "collection")}
                  value={trigger.options.collection ?? ""}
                  onChange={value => handleOptionChange(index, "collection", value as string)}
                  dimensionX="fill"
                />
              </div>
              <div className={styles.fieldGroup}>
                <span className={styles.fieldLabel}>Operation</span>
                <Select
                  options={operationOptions}
                  value={trigger.options.type ?? "INSERT"}
                  onChange={value => handleOptionChange(index, "type", value as string)}
                  dimensionX="fill"
                />
              </div>
            </>
          )}
          {trigger.type === "schedule" && (
            <>
              <div className={styles.fieldGroup}>
                <span className={styles.fieldLabel}>Cron Expression</span>
                <Input
                  placeholder="* * * * *"
                  value={trigger.options.frequency ?? ""}
                  onChange={e => handleOptionChange(index, "frequency", e.target.value)}
                />
              </div>
              <div className={styles.fieldGroup}>
                <span className={styles.fieldLabel}>Timezone</span>
                <Input
                  placeholder="UTC"
                  value={trigger.options.timezone ?? ""}
                  onChange={e => handleOptionChange(index, "timezone", e.target.value)}
                />
              </div>
            </>
          )}
          {trigger.type === "system" && (
            <div className={styles.fieldGroup}>
              <span className={styles.fieldLabel}>Event</span>
              <Select
                options={systemEventOptions}
                value={trigger.options.name ?? "READY"}
                onChange={value => handleOptionChange(index, "name", value as string)}
                dimensionX="fill"
              />
            </div>
          )}
          {trigger.type === "bucket" && (
            <>
              <div className={styles.fieldGroup}>
                <span className={styles.fieldLabel}>Bucket</span>
                <Select
                  options={getEnqueuerPropertyOptions("bucket", "bucket")}
                  value={trigger.options.bucket ?? ""}
                  onChange={value => handleOptionChange(index, "bucket", value as string)}
                  dimensionX="fill"
                />
              </div>
              <div className={styles.fieldGroup}>
                <span className={styles.fieldLabel}>Operation Type</span>
                <Select
                  options={bucketOperationOptions}
                  value={trigger.options.type ?? "ALL"}
                  onChange={value => handleOptionChange(index, "type", value as string)}
                  dimensionX="fill"
                />
              </div>
            </>
          )}
          {trigger.type === "rabbitmq" &&
            (() => {
              const queue = trigger.options.queue ?? {};
              const exchange = trigger.options.exchange;
              const consume = trigger.options.consume ?? {};
              const bindings: any[] = trigger.options.bindings ?? [];
              const exchangeBindings: any[] = trigger.options.exchangeBindings ?? [];

              return (
                <>
                  <div className={styles.fieldGroup}>
                    <span className={styles.fieldLabel}>Connection URL</span>
                    <Input
                      dimensionX="fill"
                      placeholder="amqps://user:password@host:5671"
                      value={trigger.options.url ?? ""}
                      onChange={e => handleOptionChange(index, "url", e.target.value)}
                    />
                  </div>

                  <span className={styles.sectionTitle}>Queue</span>
                  <div className={styles.fieldGroup}>
                    <span className={styles.fieldLabel}>Name</span>
                    <Input
                      dimensionX="fill"
                      placeholder="Leave empty to let the broker generate one"
                      value={queue.name ?? ""}
                      onChange={e =>
                        handleSectionFieldChange(index, "queue", "name", e.target.value)
                      }
                    />
                  </div>
                  <div className={styles.togglesGrid}>
                    <div className={styles.optionRow}>
                      <span className={styles.fieldLabel}>Durable</span>
                      <Switch
                        checked={!!queue.durable}
                        size="small"
                        onChange={checked =>
                          handleSectionFieldChange(index, "queue", "durable", checked)
                        }
                      />
                    </div>
                    <div className={styles.optionRow}>
                      <span className={styles.fieldLabel}>Exclusive</span>
                      <Switch
                        checked={!!queue.exclusive}
                        size="small"
                        onChange={checked =>
                          handleSectionFieldChange(index, "queue", "exclusive", checked)
                        }
                      />
                    </div>
                    <div className={styles.optionRow}>
                      <span className={styles.fieldLabel}>Auto Delete</span>
                      <Switch
                        checked={!!queue.autoDelete}
                        size="small"
                        onChange={checked =>
                          handleSectionFieldChange(index, "queue", "autoDelete", checked)
                        }
                      />
                    </div>
                    <div className={styles.optionRow}>
                      <span className={styles.fieldLabel}>Passive (attach only)</span>
                      <Switch
                        checked={!!queue.passive}
                        size="small"
                        onChange={checked =>
                          handleSectionFieldChange(index, "queue", "passive", checked)
                        }
                      />
                    </div>
                  </div>
                  <div className={styles.rateLimitFields}>
                    <div className={styles.fieldGroup}>
                      <span className={styles.fieldLabel}>Message TTL (ms)</span>
                      <input
                        className={styles.numberInput}
                        type="number"
                        min={0}
                        value={queue.messageTtl ?? ""}
                        onChange={e =>
                          handleSectionFieldChange(
                            index,
                            "queue",
                            "messageTtl",
                            e.target.value === "" ? undefined : Number(e.target.value)
                          )
                        }
                      />
                    </div>
                    <div className={styles.fieldGroup}>
                      <span className={styles.fieldLabel}>Expires (ms)</span>
                      <input
                        className={styles.numberInput}
                        type="number"
                        min={0}
                        value={queue.expires ?? ""}
                        onChange={e =>
                          handleSectionFieldChange(
                            index,
                            "queue",
                            "expires",
                            e.target.value === "" ? undefined : Number(e.target.value)
                          )
                        }
                      />
                    </div>
                  </div>
                  <div className={styles.rateLimitFields}>
                    <div className={styles.fieldGroup}>
                      <span className={styles.fieldLabel}>Max Length</span>
                      <input
                        className={styles.numberInput}
                        type="number"
                        min={0}
                        value={queue.maxLength ?? ""}
                        onChange={e =>
                          handleSectionFieldChange(
                            index,
                            "queue",
                            "maxLength",
                            e.target.value === "" ? undefined : Number(e.target.value)
                          )
                        }
                      />
                    </div>
                    <div className={styles.fieldGroup}>
                      <span className={styles.fieldLabel}>Max Priority</span>
                      <input
                        className={styles.numberInput}
                        type="number"
                        min={0}
                        value={queue.maxPriority ?? ""}
                        onChange={e =>
                          handleSectionFieldChange(
                            index,
                            "queue",
                            "maxPriority",
                            e.target.value === "" ? undefined : Number(e.target.value)
                          )
                        }
                      />
                    </div>
                  </div>
                  <div className={styles.fieldGroup}>
                    <span className={styles.fieldLabel}>Dead Letter Exchange</span>
                    <Input
                      dimensionX="fill"
                      placeholder="orders.dead"
                      value={queue.deadLetterExchange ?? ""}
                      onChange={e =>
                        handleSectionFieldChange(
                          index,
                          "queue",
                          "deadLetterExchange",
                          e.target.value
                        )
                      }
                    />
                  </div>
                  <div className={styles.fieldGroup}>
                    <span className={styles.fieldLabel}>Dead Letter Routing Key</span>
                    <Input
                      dimensionX="fill"
                      placeholder="Optional"
                      value={queue.deadLetterRoutingKey ?? ""}
                      onChange={e =>
                        handleSectionFieldChange(
                          index,
                          "queue",
                          "deadLetterRoutingKey",
                          e.target.value
                        )
                      }
                    />
                  </div>
                  <JsonFieldInput
                    fieldKey="queue-arguments"
                    title="Queue Arguments"
                    description="Any other queue argument, e.g. x-queue-type, x-delivery-limit, x-overflow."
                    value={queue.arguments}
                    onChange={e =>
                      handleSectionFieldChange(index, "queue", "arguments", e.value ?? undefined)
                    }
                  />

                  <div className={styles.optionRow}>
                    <span className={styles.sectionTitle}>Exchange</span>
                    <Switch
                      checked={!!exchange}
                      size="small"
                      onChange={checked =>
                        handleToggleSection(index, "exchange", checked, {
                          name: "",
                          type: "topic",
                          durable: false,
                          pattern: ""
                        })
                      }
                    />
                  </div>
                  {exchange && (
                    <>
                      <div className={styles.fieldGroup}>
                        <span className={styles.fieldLabel}>Name</span>
                        <Input
                          dimensionX="fill"
                          value={exchange.name ?? ""}
                          onChange={e =>
                            handleSectionFieldChange(index, "exchange", "name", e.target.value)
                          }
                        />
                      </div>
                      <div className={styles.fieldGroup}>
                        <span className={styles.fieldLabel}>Type</span>
                        <Input
                          dimensionX="fill"
                          placeholder="direct, topic, fanout, headers, or a plugin type"
                          value={exchange.type ?? ""}
                          onChange={e =>
                            handleSectionFieldChange(index, "exchange", "type", e.target.value)
                          }
                        />
                      </div>
                      <div className={styles.fieldGroup}>
                        <span className={styles.fieldLabel}>Routing Key(s)</span>
                        <Input
                          dimensionX="fill"
                          placeholder="orders.* or a comma-separated list"
                          value={
                            Array.isArray(exchange.pattern)
                              ? exchange.pattern.join(", ")
                              : (exchange.pattern ?? "")
                          }
                          onChange={e => {
                            const raw = e.target.value;
                            const list = raw
                              .split(",")
                              .map(p => p.trim())
                              .filter(Boolean);
                            handleSectionFieldChange(
                              index,
                              "exchange",
                              "pattern",
                              list.length > 1 ? list : raw
                            );
                          }}
                        />
                      </div>
                      <div className={styles.togglesGrid}>
                        <div className={styles.optionRow}>
                          <span className={styles.fieldLabel}>Durable</span>
                          <Switch
                            checked={!!exchange.durable}
                            size="small"
                            onChange={checked =>
                              handleSectionFieldChange(index, "exchange", "durable", checked)
                            }
                          />
                        </div>
                        <div className={styles.optionRow}>
                          <span className={styles.fieldLabel}>Internal</span>
                          <Switch
                            checked={!!exchange.internal}
                            size="small"
                            onChange={checked =>
                              handleSectionFieldChange(index, "exchange", "internal", checked)
                            }
                          />
                        </div>
                        <div className={styles.optionRow}>
                          <span className={styles.fieldLabel}>Auto Delete</span>
                          <Switch
                            checked={!!exchange.autoDelete}
                            size="small"
                            onChange={checked =>
                              handleSectionFieldChange(index, "exchange", "autoDelete", checked)
                            }
                          />
                        </div>
                        <div className={styles.optionRow}>
                          <span className={styles.fieldLabel}>Passive (attach only)</span>
                          <Switch
                            checked={!!exchange.passive}
                            size="small"
                            onChange={checked =>
                              handleSectionFieldChange(index, "exchange", "passive", checked)
                            }
                          />
                        </div>
                      </div>
                      <div className={styles.fieldGroup}>
                        <span className={styles.fieldLabel}>Alternate Exchange</span>
                        <Input
                          dimensionX="fill"
                          placeholder="Optional"
                          value={exchange.alternateExchange ?? ""}
                          onChange={e =>
                            handleSectionFieldChange(
                              index,
                              "exchange",
                              "alternateExchange",
                              e.target.value
                            )
                          }
                        />
                      </div>
                      <JsonFieldInput
                        fieldKey="exchange-headers"
                        title="Headers (for a headers-type exchange)"
                        value={exchange.headers}
                        onChange={e =>
                          handleSectionFieldChange(
                            index,
                            "exchange",
                            "headers",
                            e.value ?? undefined
                          )
                        }
                      />
                      <JsonFieldInput
                        fieldKey="exchange-arguments"
                        title="Exchange Arguments"
                        value={exchange.arguments}
                        onChange={e =>
                          handleSectionFieldChange(
                            index,
                            "exchange",
                            "arguments",
                            e.value ?? undefined
                          )
                        }
                      />
                    </>
                  )}

                  <span className={styles.sectionTitle}>Additional Queue Bindings</span>
                  {bindings.map((binding, bindingIndex) => (
                    <div className={styles.bindingRow} key={bindingIndex}>
                      <Input
                        dimensionX="fill"
                        placeholder="Exchange"
                        value={binding.exchange ?? ""}
                        onChange={e =>
                          handleBindingFieldChange(
                            index,
                            "bindings",
                            bindingIndex,
                            "exchange",
                            e.target.value
                          )
                        }
                      />
                      <Input
                        dimensionX="fill"
                        placeholder="Routing key"
                        value={binding.pattern ?? ""}
                        onChange={e =>
                          handleBindingFieldChange(
                            index,
                            "bindings",
                            bindingIndex,
                            "pattern",
                            e.target.value
                          )
                        }
                      />
                      <button
                        type="button"
                        className={styles.triggerDeleteButton}
                        aria-label="Remove binding"
                        onClick={() => handleRemoveBinding(index, "bindings", bindingIndex)}
                      >
                        <Icon name="close" size="sm" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className={styles.addRowButton}
                    onClick={() => handleAddBinding(index, "bindings", {exchange: "", pattern: ""})}
                  >
                    + Add binding
                  </button>

                  <span className={styles.sectionTitle}>Exchange-to-Exchange Bindings</span>
                  {exchangeBindings.map((binding, bindingIndex) => (
                    <div className={styles.bindingRow} key={bindingIndex}>
                      <Input
                        dimensionX="fill"
                        placeholder="Source"
                        value={binding.source ?? ""}
                        onChange={e =>
                          handleBindingFieldChange(
                            index,
                            "exchangeBindings",
                            bindingIndex,
                            "source",
                            e.target.value
                          )
                        }
                      />
                      <Input
                        dimensionX="fill"
                        placeholder="Destination"
                        value={binding.destination ?? ""}
                        onChange={e =>
                          handleBindingFieldChange(
                            index,
                            "exchangeBindings",
                            bindingIndex,
                            "destination",
                            e.target.value
                          )
                        }
                      />
                      <Input
                        dimensionX="fill"
                        placeholder="Routing key"
                        value={binding.pattern ?? ""}
                        onChange={e =>
                          handleBindingFieldChange(
                            index,
                            "exchangeBindings",
                            bindingIndex,
                            "pattern",
                            e.target.value
                          )
                        }
                      />
                      <button
                        type="button"
                        className={styles.triggerDeleteButton}
                        aria-label="Remove binding"
                        onClick={() => handleRemoveBinding(index, "exchangeBindings", bindingIndex)}
                      >
                        <Icon name="close" size="sm" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className={styles.addRowButton}
                    onClick={() =>
                      handleAddBinding(index, "exchangeBindings", {
                        source: "",
                        destination: "",
                        pattern: ""
                      })
                    }
                  >
                    + Add exchange binding
                  </button>

                  <span className={styles.sectionTitle}>Consuming</span>
                  <div className={styles.optionRow}>
                    <span className={styles.fieldLabel}>Acknowledge from the function</span>
                    <Switch
                      checked={trigger.options.noAck === false}
                      size="small"
                      onChange={checked => handleOptionChange(index, "noAck", !checked)}
                    />
                  </div>
                  <span className={styles.fieldHint}>
                    {trigger.options.noAck === false
                      ? "The function calls channel.ack / channel.nack."
                      : "The broker considers a message delivered as soon as it is sent."}
                  </span>
                  <div className={styles.rateLimitFields}>
                    <div className={styles.fieldGroup}>
                      <span className={styles.fieldLabel}>Prefetch</span>
                      <input
                        className={styles.numberInput}
                        type="number"
                        min={0}
                        value={trigger.options.prefetch ?? ""}
                        onChange={e =>
                          handleOptionChange(
                            index,
                            "prefetch",
                            e.target.value === "" ? undefined : Number(e.target.value)
                          )
                        }
                      />
                    </div>
                    <div className={styles.optionRow}>
                      <span className={styles.fieldLabel}>Prefetch is per-channel</span>
                      <Switch
                        checked={!!trigger.options.prefetchGlobal}
                        size="small"
                        onChange={checked => handleOptionChange(index, "prefetchGlobal", checked)}
                      />
                    </div>
                  </div>
                  <div className={styles.fieldGroup}>
                    <span className={styles.fieldLabel}>Consumer Tag</span>
                    <Input
                      dimensionX="fill"
                      placeholder="Generated by the broker if left empty"
                      value={consume.consumerTag ?? ""}
                      onChange={e =>
                        handleSectionFieldChange(index, "consume", "consumerTag", e.target.value)
                      }
                    />
                  </div>
                  <div className={styles.togglesGrid}>
                    <div className={styles.optionRow}>
                      <span className={styles.fieldLabel}>Exclusive Consumer</span>
                      <Switch
                        checked={!!consume.exclusive}
                        size="small"
                        onChange={checked =>
                          handleSectionFieldChange(index, "consume", "exclusive", checked)
                        }
                      />
                    </div>
                    <div className={styles.optionRow}>
                      <span className={styles.fieldLabel}>No Local</span>
                      <Switch
                        checked={!!consume.noLocal}
                        size="small"
                        onChange={checked =>
                          handleSectionFieldChange(index, "consume", "noLocal", checked)
                        }
                      />
                    </div>
                  </div>
                  <div className={styles.fieldGroup}>
                    <span className={styles.fieldLabel}>Consumer Priority</span>
                    <input
                      className={styles.numberInput}
                      type="number"
                      value={consume.priority ?? ""}
                      onChange={e =>
                        handleSectionFieldChange(
                          index,
                          "consume",
                          "priority",
                          e.target.value === "" ? undefined : Number(e.target.value)
                        )
                      }
                    />
                  </div>
                  <JsonFieldInput
                    fieldKey="consume-arguments"
                    title="Consumer Arguments"
                    description="e.g. x-stream-offset for streams."
                    value={consume.arguments}
                    onChange={e =>
                      handleSectionFieldChange(index, "consume", "arguments", e.value ?? undefined)
                    }
                  />

                  <span className={styles.sectionTitle}>Advanced</span>
                  <JsonFieldInput
                    fieldKey="socket-options"
                    title="Socket Options"
                    description="TLS (ca, cert, key, passphrase, servername, rejectUnauthorized), timeout, clientProperties."
                    value={trigger.options.socketOptions}
                    onChange={e => handleOptionChange(index, "socketOptions", e.value ?? undefined)}
                  />
                </>
              );
            })()}
          {!KNOWN_TRIGGER_TYPES.includes(trigger.type) && (
            <JsonFieldInput
              fieldKey="raw-options"
              title="Options"
              description="This trigger type has no dedicated form yet; edit its options as JSON."
              value={trigger.options}
              onChange={e => handleReplaceOptions(index, e.value ?? {})}
            />
          )}
        </FlexElement>
      </PanelAccordionItem>
    );
  });

  return (
    <FlexElement direction="vertical" dimensionX="fill" gap={8}>
      {triggerItems.length === 0 ? (
        <div className={styles.emptyState}>
          <Icon name="function" size="md" />
          <span>No triggers configured yet</span>
        </div>
      ) : (
        <PanelAccordion className={styles.triggerList}>{triggerItems}</PanelAccordion>
      )}
      <button type="button" onClick={handleAddTrigger} className={styles.addTriggerButton}>
        <svg
          width="11"
          height="11"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Add Trigger
      </button>
    </FlexElement>
  );
};

export default memo(TriggerPanel);
