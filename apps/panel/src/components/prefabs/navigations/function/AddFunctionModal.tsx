/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import {memo, useCallback, useEffect, useMemo, useState} from "react";
import {Button, FlexElement, FluidContainer, Icon, Input, Modal, Select, Text} from "oziko-ui-kit";
import {
  useCreateFunctionMutation,
  useUpdateFunctionIndexMutation,
  useGetFunctionInformationQuery
} from "../../../../store/api/functionApi";
import type {SpicaFunction, Enqueuer} from "../../../../store/api/functionApi";
import styles from "./AddFunctionModal.module.scss";

type AddFunctionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (fn: SpicaFunction) => void;
};

const LANGUAGE_OPTIONS = [
  {label: "JavaScript", value: "javascript"},
  {label: "TypeScript", value: "typescript"}
];

const FALLBACK_TRIGGER_TYPE_OPTIONS = [
  {label: "Http", value: "http"},
  {label: "Firehose", value: "firehose"},
  {label: "Database", value: "database"},
  {label: "Scheduler", value: "schedule"},
  {label: "System", value: "system"},
  {label: "Bucket", value: "bucket"}
];

const TRIGGER_EXAMPLES: Record<string, string> = {
  http: `export default function (req, res) {\n\treturn res.status(201).send("Spica is awesome!");\n}`,
  firehose: `export default function ({ socket, pool }, message) {\n\tconsole.log(message.name);\n\tconsole.log(message.data);\n\tconst isAuthorized = false;\n\tif (isAuthorized) {\n\t\tsocket.send("authorization", { state: true });\n\t\tpool.send("connection", { id: socket.id, ip_address: socket.remoteAddress });\n\t} else {\n\t\tsocket.send("authorization", { state: false, error: "Authorization has failed." });\n\t\tsocket.close();\n\t}\n}`,
  database: `export default function (change) {\n\tconsole.log(change.kind + " action has been performed on document with id " + change.documentKey + " of collection " + change.collection);\n\tconsole.log("Document: ", change.document);\n}`,
  schedule: `export default function () {\n\tconsole.log("Scheduled function executed.");\n}`,
  system: `export default function () {\n\tconsole.log("Spica is ready.");\n}`,
  bucket: `export default function (change) {\n\tconsole.log(change.kind + " action has been performed on document with id " + change.documentKey + " of bucket with id " + change.bucket);\n\tconsole.log("Previous document: ", change.previous);\n\tif (change.current) {\n\t\tconsole.log("Current document: ", change.current);\n\t}\n}`
};

const DATABASE_EXAMPLES: Record<string, string> = {
  INSERT: `export default function (change) {\n\tconsole.log(change.kind + " action has been performed on document with id " + change.documentKey + " of collection " + change.collection);\n\tconsole.log("Document: ",change.document);\n}`,
  REPLACE: `export default function (change) {\n\tconsole.log(change.kind + " action has been performed on document with id " + change.documentKey + " of collection " + change.collection);\n\tconsole.log("Document: ", change.document);\n}`,
  UPDATE: `export default function (change) {\n\tconsole.log(change.kind + " action has been performed on document with id " + change.documentKey + " of collection " + change.collection);\n\tconsole.log("Document: ",change.document);\n}`,
  DELETE: `export default function (change) {\n\tconsole.log(change.kind + " action has been performed on document with id " + change.documentKey + " of collection " + change.collection);\n}`
};

const BUCKET_EXAMPLES: Record<string, string> = {
  ALL: `export default function (change) {\n\tconsole.log(change.kind + " action has been performed on document with id " + change.documentKey + " of bucket with id " + change.bucket);\n\tconsole.log("Previous document: ",change.previous);\n\tif (change.current) {\n\t\tconsole.log("Current document: ",change.current)\n\t}\n}`,
  INSERT: `export default function (change) {\n\tconsole.log(change.kind + " action has been performed on document with id " + change.documentKey + " of bucket with id " + change.bucket);\n\tconsole.log("Previous document: ",change.previous);\n\tconsole.log("Current document: ",change.current)\n}`,
  UPDATE: `export default function (change) {\n\tconsole.log(change.kind + " action has been performed on document with id " + change.documentKey + " of bucket with id " + change.bucket);\n\tconsole.log("Previous document: ",change.previous);\n\tconsole.log("Current document: ",change.current)\n}`,
  DELETE: `export default function (change) {\n\tconsole.log(change.kind + " action has been performed on document with id " + change.documentKey + " of bucket with id " + change.bucket);\n\tconsole.log("Previous document: ",change.previous)\n}`
};

const getDefaultTriggerOptions = (enqueuers: Enqueuer[], type: string): Record<string, any> => {
  const enqueuer = enqueuers.find(e => e.description.name === type);
  if (!enqueuer?.options?.properties) return {};
  const defaults: Record<string, any> = {};
  for (const [key, schema] of Object.entries(enqueuer.options.properties)) {
    if ((schema as any).default !== undefined) {
      defaults[key] = (schema as any).default;
    }
  }
  return defaults;
};

const getExampleCode = (type: string, options: Record<string, any>): string => {
  if (type === "database") {
    return options.type
      ? (DATABASE_EXAMPLES[options.type] ?? TRIGGER_EXAMPLES.database)
      : TRIGGER_EXAMPLES.database;
  }
  if (type === "bucket") {
    return options.type
      ? (BUCKET_EXAMPLES[options.type] ?? TRIGGER_EXAMPLES.bucket)
      : TRIGGER_EXAMPLES.bucket;
  }
  return TRIGGER_EXAMPLES[type] ?? TRIGGER_EXAMPLES.http;
};

const AddFunctionModal = ({isOpen, onClose, onCreated}: AddFunctionModalProps) => {
  const [name, setName] = useState("");
  const [language, setLanguage] = useState<string>("javascript");
  const [timeout, setTimeout] = useState(10);
  const [triggerType, setTriggerType] = useState<string>("http");
  const [triggerOptionValues, setTriggerOptionValues] = useState<Record<string, any>>({});
  const [error, setError] = useState("");

  const {data: information} = useGetFunctionInformationQuery();
  const [createFunction, {isLoading: isCreating}] = useCreateFunctionMutation();
  const [updateIndex] = useUpdateFunctionIndexMutation();

  const maxTimeout = information?.timeout ?? 120;

  const triggerTypeSelectOptions =
    information?.enqueuers && information.enqueuers.length > 0
      ? information.enqueuers.map(e => ({label: e.description.title, value: e.description.name}))
      : FALLBACK_TRIGGER_TYPE_OPTIONS;

  const selectedEnqueuer = useMemo(
    () => information?.enqueuers?.find(e => e.description.name === triggerType),
    [information, triggerType]
  );

  useEffect(() => {
    setTriggerOptionValues(getDefaultTriggerOptions(information?.enqueuers ?? [], triggerType));
  }, [triggerType, information]);

  const handleTriggerOptionChange = useCallback((key: string, value: any) => {
    setTriggerOptionValues(prev => ({...prev, [key]: value}));
  }, []);

  const handleTriggerTypeChange = useCallback((value: string) => {
    setTriggerType(value);
  }, []);

  const resetForm = useCallback(() => {
    setName("");
    setLanguage("javascript");
    setTimeout(10);
    setTriggerType("http");
    setTriggerOptionValues({});
    setError("");
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const handleSave = useCallback(async () => {
    setError("");
    const trimmed = name.trim();

    if (!trimmed) {
      setError("Name is required.");
      return;
    }
    if (trimmed.length < 3) {
      setError("Name must be at least 3 characters.");
      return;
    }
    if (trimmed.length > 50) {
      setError("Name cannot exceed 50 characters.");
      return;
    }

    try {
      const result = await createFunction({
        name: trimmed,
        language: language as "javascript" | "typescript",
        timeout,
        triggers: {
          default: {type: triggerType, active: true, options: triggerOptionValues}
        }
      }).unwrap();

      const exampleCode = getExampleCode(triggerType, triggerOptionValues);
      if (result._id) {
        await updateIndex({id: result._id, index: exampleCode}).unwrap();
      }

      resetForm();
      onCreated(result);
      onClose();
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Failed to create function.");
    }
  }, [
    name,
    language,
    timeout,
    triggerType,
    triggerOptionValues,
    createFunction,
    updateIndex,
    resetForm,
    onCreated,
    onClose
  ]);

  const formatTimeout = (val: number) => (val >= 60 ? `${(val / 60).toFixed(1)}m` : `${val}s`);

  const renderTriggerOptionFields = () => {
    const properties = selectedEnqueuer?.options?.properties;
    if (!properties) return null;

    return Object.entries(properties).map(([key, schema]: [string, any]) => {
      const label = schema.title ?? key;
      const value = triggerOptionValues[key];

      if (schema.type === "boolean") {
        return (
          <FlexElement
            key={key}
            dimensionX="fill"
            gap={8}
            alignment="leftCenter"
            className={styles.checkboxRow}
          >
            <input
              type="checkbox"
              checked={value ?? false}
              onChange={e => handleTriggerOptionChange(key, e.target.checked)}
              id={`trigger-opt-${key}`}
            />
            <label htmlFor={`trigger-opt-${key}`}>
              <Text size="small" className={styles.fieldLabel}>
                {label}
              </Text>
            </label>
          </FlexElement>
        );
      }

      if (schema.enum) {
        const viewEnum = schema.viewEnum as string[] | undefined;
        const selectOptions = (schema.enum as string[]).map((val: string, i: number) => ({
          label: viewEnum?.[i] ?? val,
          value: val
        }));
        return (
          <FlexElement key={key} direction="vertical" alignment="leftCenter" dimensionX="fill" gap={6}>
            <Text size="small" dimensionX="fill" className={styles.fieldLabel}>
              {label}
            </Text>

              <Select
                options={selectOptions}
                value={value ?? ""}
                onChange={v => handleTriggerOptionChange(key, v as string)}
                dimensionX="fill"
              />

          </FlexElement>
        );
      }

      const placeholder = schema.examples?.[0] ?? schema.description ?? "";
      return (
        <FlexElement key={key} direction="vertical" alignment="leftCenter" dimensionX="fill" gap={6}>
          <Text size="small" dimensionX="fill" className={styles.fieldLabel}>
            {label}
          </Text>
          <FlexElement gap={5} className={styles.inputContainer}>
            <Icon name="formatQuoteClose" size="md" />
            <Input
              placeholder={String(placeholder)}
              value={value ?? ""}
              onChange={e => handleTriggerOptionChange(key, e.target.value)}
              className={styles.input}
              type="text"
            />
          </FlexElement>
        </FlexElement>
      );
    });
  };

  if (!isOpen) return null;

  const baseUrl = (import.meta.env.VITE_BASE_URL as string) || "";

  return (
    <Modal showCloseButton={false} onClose={handleClose} className={styles.modal} isOpen>
      <FluidContainer
        className={styles.container}
        direction="vertical"
        gap={10}
        mode="fill"
        prefix={{
          children: (
            <div className={styles.header}>
              <Text className={styles.headerText}>ADD NEW FUNCTION</Text>
            </div>
          )
        }}
        root={{
          children: (
            <FlexElement
              direction="vertical"
              dimensionX="fill"
              alignment="leftCenter"
              gap={12}
              className={styles.formBody}
            >
              <FlexElement direction="vertical"  alignment="leftCenter" dimensionX="fill" gap={6}>
                <Text size="small" dimensionX="fill" className={styles.fieldLabel}>
                  Name
                </Text>

                <FlexElement gap={5} className={styles.inputContainer}>
                  <Icon name="formatQuoteClose" size="md" />
                  <Input
                    placeholder="Function name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className={styles.input}
                  />
                </FlexElement>
              </FlexElement>

              <FlexElement direction="vertical" alignment="leftCenter" dimensionX="fill" gap={6}>
                <Text size="small" dimensionX="fill" className={styles.fieldLabel}>
                  Language
                </Text>

                  <Select
                    options={LANGUAGE_OPTIONS}
                    value={language}
                    onChange={v => setLanguage(v as string)}
                    dimensionX="fill"
                  />

              </FlexElement>

              <FlexElement direction="vertical" alignment="leftCenter" dimensionX="fill" gap={6}>
                <Text size="small" dimensionX="fill" className={styles.fieldLabel}>
                  Timeout ({formatTimeout(timeout)})
                </Text>
                  <input
                    type="range"
                    className={styles.slider}
                    min={1}
                    max={maxTimeout}
                    step={1}
                    value={timeout}
                    onChange={e => setTimeout(Number(e.target.value))}
                  />
              </FlexElement>


                <Text size="xlarge" dimensionX="fill" className={styles.triggerHeading}>
                  Trigger
                </Text>


              <FlexElement direction="vertical" alignment="leftCenter" dimensionX="fill" gap={6}>
                <Text size="small" dimensionX="fill" className={styles.fieldLabel}>
                  Type
                </Text>

                  <Select
                    options={triggerTypeSelectOptions}
                    value={triggerType}
                    onChange={v => handleTriggerTypeChange(v as string)}
                    dimensionX="fill"
                  />
              </FlexElement>

              {renderTriggerOptionFields()}

              {triggerType === "http" && triggerOptionValues.path && (
                <Text size="small" className={styles.httpUrlPreview}>
                  {baseUrl}/fn-execute{triggerOptionValues.path}
                </Text>
              )}

              {error && (
                <Text variant="danger" className={styles.errorText}>
                  {error}
                </Text>
              )}
            </FlexElement>
          )
        }}
        suffix={{
          dimensionX: "fill",
          alignment: "rightCenter",
          children: (
            <FlexElement gap={10} className={styles.buttonsContainer}>
              <Button onClick={handleSave} variant="solid" color="primary" disabled={isCreating || !name.trim() || !triggerType} loading={isCreating}>
                <Icon name="plus" />
                <Text color="white" className={styles.createButtonText}>Create</Text>
              </Button>
              <Button variant="text" onClick={handleClose} disabled={isCreating}>
                <Icon name="close" />
                <Text>Cancel</Text>
              </Button>
            </FlexElement>
          )
        }}
      />
    </Modal>
  );
};

export default memo(AddFunctionModal);
