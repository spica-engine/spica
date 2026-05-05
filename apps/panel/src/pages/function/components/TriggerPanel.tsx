/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import {memo, useCallback} from "react";
import {useCopyToClipboard} from "../../../hooks/useCopyToClipboard";
import {
  Accordion,
  BooleanInput,
  Button,
  FlexElement,
  FluidContainer,
  Icon,
  Input,
  Select,
  Text,
  type TypeAccordionItem
} from "oziko-ui-kit";
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
      options: {}
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
      onChange(triggers.map((t, i) => (i === index ? {...t, type, options: {}} : t)));
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

  const triggerItems: TypeAccordionItem[] = triggers.map((trigger, index) => {
    return {
      title: (
        <FluidContainer
          dimensionX="fill"
          mode="fill"
          alignment="leftCenter"
          root={{
            children: <Text size="small">{trigger.handler ?? trigger.type}</Text>,
            alignment: "leftCenter"
          }}
          suffix={{
            children: (
              <FlexElement gap={4} alignment="leftCenter" onClick={e => e.stopPropagation()}>
                <BooleanInput
                  checked={trigger.active !== false}
                  onChange={active => handleActiveChange(index, active)}
                  size="small"
                  containerProps={{className: styles.statusToggle}}
                />
                <Button
                  variant="icon"
                  color="danger"
                  className={styles.deleteAction}
                  onClick={() => handleDeleteTrigger(index)}
                >
                  <Icon name="delete" size="sm" />
                </Button>
              </FlexElement>
            )
          }}
        />
      ),
      content: (() => {
        const handlerOptions = handlers.map(h => ({
          label: h,
          value: h,
          disabled: triggers.some((t, ti) => ti !== index && t.handler === h),
        }));
        return (
        <FlexElement direction="vertical" dimensionX="fill" gap={10}>
          <FlexElement direction="vertical" dimensionX="fill" gap={6}>
            <Text size="small" dimensionX={"fill"} className={styles.fieldLabel}>
              Handler
            </Text>
            <Select
              options={handlerOptions}
              value={trigger.handler ?? ""}
              onChange={value => handleHandlerChange(index, value as string)}
              dimensionX="fill"
            />
          </FlexElement>
          <FlexElement direction="vertical" dimensionX="fill" gap={6}>
            <Text size="small" dimensionX={"fill"} className={styles.fieldLabel}>
              Type
            </Text>
            <Select
              options={typeOptions}
              value={trigger.type}
              onChange={value => handleTypeChange(index, value as FunctionTrigger["type"])}
              dimensionX="fill"
            />
          </FlexElement>
          {trigger.type === "http" && (
            <FlexElement direction="vertical" dimensionX="fill" gap={6}>
              <FlexElement direction="vertical" dimensionX="fill" gap={6}>
                <Text size="small" dimensionX={"fill"} className={styles.fieldLabel}>
                  Method
                </Text>
                <Select
                  options={methodOptions}
                  value={trigger.options.method ?? "All"}
                  onChange={value => handleOptionChange(index, "method", value as string)}
                  dimensionX="fill"
                />
              </FlexElement>
              <FlexElement direction="vertical" dimensionX="fill" alignment="leftTop" gap={6}>
                <Text size="small" dimensionX={"fill"} className={styles.fieldLabel}>
                  Path
                </Text>
              </FlexElement>

              <FlexElement gap={5} className={styles.inputContainer}>
                <Icon name="formatQuoteClose" size="md" />
                <Input
                  placeholder="/my-endpoint"
                  value={trigger.options.path ?? ""}
                  onChange={e => handleOptionChange(index, "path", e.target.value)}
                  className={styles.input}
                  type="text"
                />
              </FlexElement>
              <FlexElement dimensionX="fill" alignment="leftCenter" gap={4}>
                <Text size="small" dimensionX={"fill"} className={styles.path}>
                  {`${BASE_URL}/fn-execute${trigger.options.path ?? ""}`}
                </Text>
                <Button
                  variant="icon"
                  color="default"
                  className={styles.copyAction}
                  onClick={() => copyUrl(`${BASE_URL}/fn-execute${trigger.options.path ?? ""}`)}
                >
                  <Icon name={urlCopied ? "check" : "contentCopy"} size="sm" />
                </Button>
              </FlexElement>
            </FlexElement>
          )}
          {trigger.type === "firehose" && (
            <FlexElement direction="vertical" dimensionX="fill" gap={6}>
              <Text size="small" dimensionX="fill" className={styles.fieldLabel}>
                Event
              </Text>
              <FlexElement gap={5} className={styles.inputContainer}>
                <Icon name="formatQuoteClose" size="md" />
                <Input
                  placeholder="* (all events), ** (connection), or custom event name"
                  value={trigger.options.event ?? ""}
                  onChange={e => handleOptionChange(index, "event", e.target.value)}
                  className={styles.input}
                  type="text"
                />
              </FlexElement>
            </FlexElement>
          )}
          {trigger.type === "database" && (
            <FlexElement direction="vertical" dimensionX="fill" gap={6}>
              <Text size="small" dimensionX="fill" className={styles.fieldLabel}>
                Collection
              </Text>
              <Select
                options={getEnqueuerPropertyOptions("database", "collection")}
                value={trigger.options.collection ?? ""}
                onChange={value => handleOptionChange(index, "collection", value as string)}
                dimensionX="fill"
              />
              <Text size="small" dimensionX="fill" className={styles.fieldLabel}>
                Operation
              </Text>
              <Select
                options={operationOptions}
                value={trigger.options.type ?? "INSERT"}
                onChange={value => handleOptionChange(index, "type", value as string)}
                dimensionX="fill"
              />
            </FlexElement>
          )}
          {trigger.type === "schedule" && (
            <FlexElement direction="vertical" dimensionX="fill" gap={6}>
              <Text size="small" className={styles.fieldLabel}>
                Cron Expression
              </Text>
              <Input
                placeholder="* * * * *"
                value={trigger.options.frequency ?? ""}
                onChange={e => handleOptionChange(index, "frequency", e.target.value)}
              />
              <Text size="small" className={styles.fieldLabel}>
                Timezone
              </Text>
              <Input
                placeholder="UTC"
                value={trigger.options.timezone ?? ""}
                onChange={e => handleOptionChange(index, "timezone", e.target.value)}
              />
            </FlexElement>
          )}
          {trigger.type === "system" && (
            <FlexElement direction="vertical" dimensionX="fill" gap={6}>
              <Text size="small" dimensionX="fill" className={styles.fieldLabel}>
                Event
              </Text>
              <Select
                options={systemEventOptions}
                value={trigger.options.name ?? "READY"}
                onChange={value => handleOptionChange(index, "name", value as string)}
                dimensionX="fill"
              />
            </FlexElement>
          )}
          {trigger.type === "bucket" && (
            <FlexElement direction="vertical" dimensionX="fill" gap={6}>
              <Text size="small" dimensionX="fill" className={styles.fieldLabel}>
                Bucket
              </Text>
              <Select
                options={getEnqueuerPropertyOptions("bucket", "bucket")}
                value={trigger.options.bucket ?? ""}
                onChange={value => handleOptionChange(index, "bucket", value as string)}
                dimensionX="fill"
              />
              <Text size="small" dimensionX="fill" className={styles.fieldLabel}>
                Operation Type
              </Text>
              <Select
                options={bucketOperationOptions}
                value={trigger.options.type ?? "ALL"}
                onChange={value => handleOptionChange(index, "type", value as string)}
                dimensionX="fill"
              />
            </FlexElement>
          )}
        </FlexElement>
        );
      })()
    };
  });

  const outerItems: TypeAccordionItem[] = [
    {
      title: (
        <FlexElement gap={8} alignment="leftCenter">
          <Text size="medium">Triggers</Text>
        </FlexElement>
      ),
      content: (
        <FlexElement direction="vertical" dimensionX="fill" gap={8}>
          {triggerItems.length > 0 && (
            <Accordion
              items={triggerItems}
              defaultActiveIndex={-1}
              suffixOnHover={false}
              noBackgroundOnFocus
              headerClassName={styles.triggerMethodAccordion}
              contentClassName={styles.triggerMethodAccordionContent}
            />
          )}
          <Button
            variant="text"
            color="default"
            onClick={handleAddTrigger}
            className={styles.addButton}
          >
            <Icon name="plus" size="sm" />
            Add Trigger
          </Button>
        </FlexElement>
      )
    }
  ];

  return <Accordion items={outerItems} suffixOnHover={false} noBackgroundOnFocus />;
};

export default memo(TriggerPanel);
