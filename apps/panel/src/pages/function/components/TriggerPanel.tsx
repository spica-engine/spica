/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import {memo, useCallback} from "react";
import {useCopyToClipboard} from "../../../hooks/useCopyToClipboard";
import {
  Button,
  FlexElement,
  Icon,
  Input,
  Select
} from "oziko-ui-kit";
import PanelAccordion, {PanelAccordionItem} from "../../../components/molecules/panel-accordion/PanelAccordion";
import type {FunctionTrigger, Enqueuer} from "../../../store/api/functionApi";
import styles from "./TriggerPanel.module.scss";

type TriggerPanelProps = {
  triggers: FunctionTrigger[];
  enqueuers: Enqueuer[];
  handlers: string[];
  onChange: (triggers: FunctionTrigger[]) => void;
};

const TRIGGER_TYPES: FunctionTrigger["type"][] = ["http", "firehose", "database", "schedule", "system", "bucket"];

const HTTP_METHODS = ["All", "Get", "Post", "Put", "Delete", "Patch", "Head"];
const DB_OPERATIONS = ["INSERT", "UPDATE", "REPLACE", "DELETE"];
const BUCKET_OPERATIONS = ["ALL", "INSERT", "UPDATE", "DELETE"];
const SYSTEM_EVENTS = ["READY"];

const BASE_URL = (import.meta.env.VITE_BASE_URL as string) || "";

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
          i === index ? {...t, type, options: type === "http" ? {method: "All"} : {}} : t
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
    (index: number, key: string, value: string) => {
      onChange(
        triggers.map((t, i) => (i === index ? {...t, options: {...t.options, [key]: value}} : t))
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

  const typeOptions = TRIGGER_TYPES.map(type => ({
    label: enqueuers.find(e => e.description.name === type)?.description.title ?? type,
    value: type
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
        value: val,
      }));
    },
    [enqueuers]
  );

  const triggerItems = triggers.map((trigger, index) => {
    const handlerOptions = handlers.map(h => ({
      label: h,
      value: h,
      disabled: triggers.some((t, ti) => ti !== index && t.handler === h),
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
              <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              </svg>
            </button>
          </>
        }
      >
        <FlexElement direction="vertical" dimensionX="fill" gap={12} className={styles.triggerItemContent}>
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
      <button
        type="button"
        onClick={handleAddTrigger}
        className={styles.addTriggerButton}
      >
        <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Add Trigger
      </button>
    </FlexElement>
  );
};

export default memo(TriggerPanel);

