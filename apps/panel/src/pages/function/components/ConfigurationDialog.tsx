/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import {memo, useCallback, useState} from "react";
import {Button, Drawer, FlexElement, Icon, Text} from "oziko-ui-kit";
import {
  useCreateFunctionMutation,
  useUpdateFunctionMutation,
  useUpdateFunctionIndexMutation,
  useGetFunctionInformationQuery,
} from "../../../store/api/functionApi";
import type {SpicaFunction, FunctionTrigger, Enqueuer} from "../../../store/api/functionApi";
import styles from "../FunctionPage.module.scss";

type ConfigurationDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  initialFunction?: SpicaFunction;
  onSaved?: (fn: SpicaFunction) => void;
};

const TRIGGER_EXAMPLES: Record<string, string> = {
  http: `export default function (req, res) {\n\treturn res.status(201).send("Spica is awesome!");\n}`,
  firehose: `export default function ({ socket, pool }, message) {\n\tconsole.log(message.name);\n\tconsole.log(message.data);\n\tconst isAuthorized = false;\n\tif (isAuthorized) {\n\t\tsocket.send("authorization", { state: true });\n\t\tpool.send("connection", { id: socket.id, ip_address: socket.remoteAddress });\n\t} else {\n\t\tsocket.send("authorization", { state: false, error: "Authorization has failed." });\n\t\tsocket.close();\n\t}\n}`,
  database: `export default function (change) {\n\tconsole.log(change.kind + " action has been performed on document with id " + change.documentKey + " of collection " + change.collection);\n\tconsole.log("Document: ", change.document);\n}`,
  schedule: `export default function () {\n\tconsole.log("Scheduled function executed.");\n}`,
  system: `export default function () {\n\tconsole.log("Spica is ready.");\n}`,
  bucket: `export default function (change) {\n\tconsole.log(change.kind + " action has been performed on document with id " + change.documentKey + " of bucket with id " + change.bucket);\n\tconsole.log("Previous document: ", change.previous);\n\tif (change.current) {\n\t\tconsole.log("Current document: ", change.current);\n\t}\n}`,
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

const ConfigurationDialog = ({
  isOpen,
  onClose,
  initialFunction,
  onSaved,
}: ConfigurationDialogProps) => {
  const isEdit = !!initialFunction?._id;

  const [name, setName] = useState(initialFunction?.name ?? "");
  const [language, setLanguage] = useState<"javascript" | "typescript">(
    initialFunction?.language ?? "javascript"
  );
  const [timeout, setTimeout] = useState(initialFunction?.timeout ?? 10);
  const [triggerType, setTriggerType] = useState<FunctionTrigger["type"]>("http");
  const [error, setError] = useState<string | null>(null);

  const {data: information} = useGetFunctionInformationQuery();
  const [createFunction, {isLoading: isCreating}] = useCreateFunctionMutation();
  const [updateFunction, {isLoading: isUpdating}] = useUpdateFunctionMutation();
  const [updateIndex] = useUpdateFunctionIndexMutation();

  const maxTimeout = information?.timeout ?? 120;
  const isSaving = isCreating || isUpdating;

  const handleSave = useCallback(async () => {
    setError(null);
    if (!name.trim() || name.trim().length < 3) {
      setError("Name must be at least 3 characters");
      return;
    }

    try {
      if (isEdit && initialFunction?._id) {
        const result = await updateFunction({
          id: initialFunction._id,
          body: {name, language, timeout},
        }).unwrap();
        onSaved?.(result);
      } else {
        const defaultOptions = getDefaultTriggerOptions(information?.enqueuers ?? [], triggerType);
        const result = await createFunction({
          name,
          language,
          timeout,
          triggers: {
            default: {type: triggerType, active: true, options: defaultOptions},
          },
        }).unwrap();

        const exampleCode = TRIGGER_EXAMPLES[triggerType] ?? TRIGGER_EXAMPLES.http;
        if (result._id) {
          await updateIndex({id: result._id, index: exampleCode}).unwrap();
        }
        onSaved?.(result);
      }
      onClose();
    } catch (err: any) {
      setError(err?.data?.message ?? err?.message ?? "Save failed");
    }
  }, [
    name, language, timeout, triggerType, isEdit, initialFunction, information,
    createFunction, updateFunction, updateIndex, onClose, onSaved,
  ]);

  const formatTimeout = useCallback((val: number) => {
    if (val >= 60) return `${(val / 60).toFixed(1)}m`;
    return `${val}s`;
  }, []);

  return (
    <Drawer
      placement="right"
      size={480}
      isOpen={isOpen}
      onClose={onClose}
      showCloseButton={false}
    >
      <FlexElement
        dimensionX="fill"
        direction="vertical"
        gap={16}
        alignment="leftTop"
        className={styles.configDrawer}
      >
        <Text size="large">{isEdit ? "Edit Function" : "New Function"}</Text>

        <label className={styles.fieldLabel} htmlFor="fn-name">Name</label>
        <input
          id="fn-name"
          className={styles.input}
          placeholder="Function name"
          value={name}
          onChange={e => setName(e.target.value)}
          minLength={3}
          maxLength={50}
        />

        <label className={styles.fieldLabel} htmlFor="fn-language">Language</label>
        <select
          id="fn-language"
          className={styles.select}
          value={language}
          onChange={e => setLanguage(e.target.value as "javascript" | "typescript")}
          disabled={isEdit}
        >
          <option value="javascript">JavaScript</option>
          <option value="typescript">TypeScript</option>
        </select>

        <label className={styles.fieldLabel} htmlFor="fn-timeout">
          Timeout ({formatTimeout(timeout)})
        </label>
        <input
          id="fn-timeout"
          type="range"
          className={styles.slider}
          min={1}
          max={maxTimeout}
          step={1}
          value={timeout}
          onChange={e => setTimeout(Number(e.target.value))}
        />

        {!isEdit && (
          <>
            <label className={styles.fieldLabel} htmlFor="fn-trigger-type">Initial Trigger</label>
            <select
              id="fn-trigger-type"
              className={styles.select}
              value={triggerType}
              onChange={e => setTriggerType(e.target.value as FunctionTrigger["type"])}
            >
              {(information?.enqueuers ?? []).map(enq => (
                <option key={enq.description.name} value={enq.description.name}>
                  {enq.description.title}
                </option>
              ))}
              {(!information?.enqueuers || information.enqueuers.length === 0) && (
                <>
                  <option value="http">Http</option>
                  <option value="firehose">Firehose</option>
                  <option value="database">Database</option>
                  <option value="schedule">Scheduler</option>
                  <option value="system">System</option>
                  <option value="bucket">Bucket</option>
                </>
              )}
            </select>
          </>
        )}

        {error && <Text size="small" className={styles.errorText}>{error}</Text>}

        <FlexElement dimensionX="fill" gap={8} alignment="rightCenter" className={styles.configActions}>
          <Button color="default" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button color="primary" onClick={handleSave} disabled={isSaving}>
            <Icon name="check" size="sm" />
            {isEdit ? "Update" : "Create"}
          </Button>
        </FlexElement>
      </FlexElement>
    </Drawer>
  );
};

export default memo(ConfigurationDialog);
