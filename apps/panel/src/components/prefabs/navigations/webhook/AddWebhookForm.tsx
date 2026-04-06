/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React, { useCallback, useRef, useState, Suspense, lazy } from "react";
import { useNavigate } from "react-router-dom";
import type { editor } from "monaco-editor";
import {
  Button,
  Checkbox,
  FlexElement,
  Icon,
  Select,
  StringInput,
  Text,
} from "oziko-ui-kit";
import {
  useCreateWebhookMutation,
  useGetWebhookCollectionsQuery,
  useUpdateWebhookMutation,
  type CreateWebhookRequest,
  type UpdateWebhookRequest,
  type Webhook,
  type WebhookTrigger,
} from "../../../../store/api/webhookApi";
import styles from "./AddWebhookForm.module.scss";

const Editor = lazy(() => import("@monaco-editor/react").then((m) => ({ default: m.default })));

const TRIGGER_TYPE_OPTIONS = [
  { label: "INSERT", value: "INSERT" },
  { label: "UPDATE", value: "UPDATE" },
  { label: "REPLACE", value: "REPLACE" },
  { label: "DELETE", value: "DELETE" },
] as const;

const DEFAULT_BODY = "{{{ toJSON this }}}";
const JSON_EDITOR_LANGUAGE = "json";

const MONACO_EDITOR_OPTIONS: editor.IStandaloneEditorConstructionOptions = {
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  wordWrap: "on",
  formatOnPaste: true,
  formatOnType: true,
  lineNumbers: "on",
  folding: true,
  automaticLayout: true,
};

type AddWebhookFormProps = {
  onClose: () => void;
  initialWebhook?: Webhook;
};

// Body accepts Handlebars templates (e.g. "{{{ toJSON this }}}") or JSON strings
const isBodyValid = (str: string): boolean => str.trim().length > 0;

export const AddWebhookForm: React.FC<AddWebhookFormProps> = ({ onClose, initialWebhook }) => {
  const navigate = useNavigate();
  const [createWebhook, { isLoading: isCreateLoading }] = useCreateWebhookMutation();
  const [updateWebhook, { isLoading: isUpdateLoading }] = useUpdateWebhookMutation();
  const { data: collections = [] } = useGetWebhookCollectionsQuery();

  const isEditMode = Boolean(initialWebhook?._id);
  const isLoading = isCreateLoading || isUpdateLoading;

  const [title, setTitle] = useState(() => initialWebhook?.title ?? "");
  const [url, setUrl] = useState(() => initialWebhook?.url ?? "");
  const [body, setBody] = useState(() => initialWebhook?.body ?? DEFAULT_BODY);
  const [collection, setCollection] = useState(
    () => initialWebhook?.trigger?.options?.collection ?? ""
  );
  const initialType = initialWebhook?.trigger?.options?.type ?? "UPDATE";
  const [type, setType] = useState<WebhookTrigger["options"]["type"]>(initialType);
  const [active, setActive] = useState(() => initialWebhook?.trigger?.active ?? true);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const bodyError = body.trim() ? null : "Body is required";
  const saveButtonLabel = (() => {
    if (isLoading) return "Saving...";
    return isEditMode ? "Update" : "Save";
  })();

  const collectionOptions = collections.map((c) => ({
    label: c.slug,
    value: c.slug,
  }));

  const resetForm = useCallback(() => {
    setTitle("");
    setUrl("");
    setBody(DEFAULT_BODY);
    setCollection("");
    setType("UPDATE");
    setActive(true);
  }, []);

  const handleBodyChange = useCallback((value: string | undefined = "") => {
    setBody(value);
  }, []);

  const handleCancel = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const hasWebhookChanged = useCallback((): boolean => {
    if (!initialWebhook) return true;
    const trimmedTitle = title.trim();
    const trimmedUrl = url.trim();
    const trimmedBody = body.trim();
    return (
      trimmedTitle !== (initialWebhook.title || "") ||
      trimmedUrl !== (initialWebhook.url || "") ||
      trimmedBody !== (initialWebhook.body || "") ||
      collection !== (initialWebhook.trigger?.options?.collection || "") ||
      type !== (initialWebhook.trigger?.options?.type || "UPDATE") ||
      active !== (initialWebhook.trigger?.active ?? true)
    );
  }, [title, url, body, collection, type, active, initialWebhook]);

  const isFormValid =
    title.trim().length > 0 &&
    url.trim().length > 0 &&
    isBodyValid(body) &&
    collection.length > 0 &&
    type.length > 0;

  const isSaveDisabled =
    !isFormValid ||
    isLoading ||
    (isEditMode && !hasWebhookChanged());

  const handleSave = useCallback(async () => {
    if (isEditMode && !hasWebhookChanged()) {
      return;
    }

    const payload: CreateWebhookRequest = {
      title: title.trim(),
      url: url.trim(),
      body: body.trim(),
      trigger: {
        name: "database",
        active,
        options: {
          collection,
          type,
        },
      },
    };

    try {
      if (isEditMode && initialWebhook?._id) {
        const updatePayload: UpdateWebhookRequest = payload;
        await updateWebhook({ id: initialWebhook._id, body: updatePayload }).unwrap();
        resetForm();
        onClose();
      } else {
        const result = await createWebhook(payload).unwrap();
        resetForm();
        onClose();
        if (result._id) {
          navigate(`/webhook/${result._id}`);
        }
      }
    } catch {
      // Error is handled by RTK Query
    }
  }, [
    title,
    url,
    body,
    collection,
    type,
    active,
    isEditMode,
    initialWebhook,
    hasWebhookChanged,
    createWebhook,
    updateWebhook,
    resetForm,
    onClose,
    navigate,
  ]);

  return (
    <FlexElement dimensionX="fill" direction="vertical" alignment="leftTop" gap={16} className={styles.form}>
      <StringInput
        label="Title"
        value={title}
        onChange={setTitle}
        dimensionX="fill"
      />

      <StringInput
        label="URL"
        value={url}
        onChange={setUrl}
        dimensionX="fill"
      />

      <FlexElement dimensionX="fill" direction="vertical" gap={4}>
        <Text size="small" className={styles.label}>
          Body
        </Text>
        <FlexElement
          dimensionX="fill"
          dimensionY={200}
          className={styles.monacoEditorWrapper}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <Suspense
            fallback={
              <FlexElement dimensionX="fill" dimensionY="fill" alignment="center">
                <Text size="small">Loading editor...</Text>
              </FlexElement>
            }
          >
            <Editor
              defaultLanguage={JSON_EDITOR_LANGUAGE}
              value={body}
              onChange={handleBodyChange}
              onMount={(editor) => {
                editorRef.current = editor;
                editor.updateOptions(MONACO_EDITOR_OPTIONS);
              }}
              options={MONACO_EDITOR_OPTIONS}
            />
          </Suspense>
        </FlexElement>
        {bodyError ? (
          <Text size="small" className={styles.error}>
            {bodyError}
          </Text>
        ) : null}
      </FlexElement>

      <FlexElement dimensionX="fill" direction="vertical" gap={8} alignment="leftTop">
        <Text size="small" className={styles.label}>
          Trigger
        </Text>
      </FlexElement>
      <FlexElement dimensionX="fill" direction="horizontal" alignment="leftTop" gap={8} className={styles.triggerSection}>
        <Select
          options={collectionOptions}
          value={collection}
          onChange={(value) => setCollection(value as string)}
          placeholder="Select collection"
          dimensionX="fill"
        />
        <Select
          options={TRIGGER_TYPE_OPTIONS.map((option) => ({
            label: option.label,
            value: option.value,
          }))}
          value={type}
          onChange={(value) => setType(value as WebhookTrigger["options"]["type"])}
          placeholder="Select type"
          dimensionX="fill"
        />
        <Checkbox
          label="Active"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
        />
      </FlexElement>

      <FlexElement dimensionX="fill" alignment="rightCenter" gap={10} className={styles.actions}>
        <Button variant="solid" color="default" onClick={handleCancel}>
          <Icon name="close" />
          Cancel
        </Button>
        <Button
          variant="solid"
          color="primary"
          onClick={handleSave}
          disabled={isSaveDisabled}
        >
          <Icon name={isEditMode ? "pencil" : "plus"} />
          {saveButtonLabel}
        </Button>
      </FlexElement>
    </FlexElement>
  );
};

export default AddWebhookForm;
