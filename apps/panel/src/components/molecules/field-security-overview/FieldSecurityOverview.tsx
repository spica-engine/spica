import {Button, FluidContainer, Icon, Modal, Text} from "oziko-ui-kit";
import {memo, useCallback, useMemo, useState, type FC} from "react";
import styles from "./FieldSecurityOverview.module.scss";
import type {BucketType} from "../../../store/api/bucketApi";
import {
  aclStatus,
  buildAclExpression,
  inferSecurityFromAcl
} from "../../../domain/fields/field-acl";
import FieldSecurityEditor, {
  type FieldSecurity
} from "../field-security-editor/FieldSecurityEditor";

type FieldSecurityOverviewProps = {
  bucket: BucketType;
  // The caller owns persistence; `acl` is `undefined` when the field is public.
  onSaveField: (fieldKey: string, acl: string | undefined) => Promise<void> | void;
  onClose: () => void;
  visible?: boolean;
};

type FieldStatus = ReturnType<typeof aclStatus>;

const STATUS_META: Record<FieldStatus, {label: string; description: string; dotClass: string}> = {
  public: {
    label: "Everyone",
    description: "Always returned by the data API.",
    dotClass: styles.dotPublic
  },
  conditional: {
    label: "Conditional",
    description: "Returned only for rows that match the rule.",
    dotClass: styles.dotConditional
  },
  restricted: {
    label: "Restricted",
    description: "Gated on the requesting identity.",
    dotClass: styles.dotRestricted
  }
};

const LEGEND_ORDER: FieldStatus[] = ["public", "conditional", "restricted"];

type FieldRow = {key: string; title: string; acl: string | undefined};

type FieldSecurityRowProps = {
  fieldKey: string;
  title: string;
  acl: string | undefined;
  onEdit: (fieldKey: string) => void;
};

const FieldSecurityRow: FC<FieldSecurityRowProps> = memo(({fieldKey, title, acl, onEdit}) => {
  const status = aclStatus(acl);
  const meta = STATUS_META[status];

  const handleEdit = useCallback(() => onEdit(fieldKey), [onEdit, fieldKey]);

  return (
    <div className={styles.row}>
      <Text className={styles.field}>{title}</Text>
      <div className={styles.access}>
        <span className={`${styles.dot} ${meta.dotClass}`} />
        <Text>{meta.label}</Text>
      </div>
      <Text className={styles.rule} title={acl || undefined}>
        {acl || "—"}
      </Text>
      <Button
        variant="text"
        shape="circle"
        onClick={handleEdit}
        className={styles.editButton}
        aria-label={`Edit read access for ${title}`}
      >
        <Icon name="pencil" size="sm" />
      </Button>
    </div>
  );
});

FieldSecurityRow.displayName = "FieldSecurityRow";

const FieldSecurityOverview: FC<FieldSecurityOverviewProps> = ({
  bucket,
  onSaveField,
  onClose,
  visible = true
}) => {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [pending, setPending] = useState<FieldSecurity | null>(null);
  const [saving, setSaving] = useState(false);

  const fields = useMemo<FieldRow[]>(
    () =>
      Object.entries(bucket.properties ?? {}).map(([key, property]) => ({
        key,
        title: (property as {title?: string}).title || key,
        acl: (property as {acl?: string}).acl
      })),
    [bucket.properties]
  );

  const editingTitle = useMemo(() => {
    if (!editingKey) return "";
    return (bucket.properties?.[editingKey] as {title?: string})?.title || editingKey;
  }, [bucket.properties, editingKey]);

  const handleEdit = useCallback(
    (fieldKey: string) => {
      const acl = (bucket.properties?.[fieldKey] as {acl?: string})?.acl;
      setPending(inferSecurityFromAcl(acl));
      setEditingKey(fieldKey);
    },
    [bucket.properties]
  );

  const handleCancelEdit = useCallback(() => {
    setEditingKey(null);
    setPending(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!editingKey) return;
    setSaving(true);
    try {
      await onSaveField(editingKey, buildAclExpression(pending ?? undefined));
      setEditingKey(null);
      setPending(null);
    } finally {
      setSaving(false);
    }
  }, [editingKey, pending, onSaveField]);

  return (
    <>
      <Modal onClose={onClose} className={styles.modal} isOpen={visible} showCloseButton={false}>
        <Modal.Body className={styles.body}>
          <div className={styles.fieldSecurityOverview}>
            <div className={styles.header}>
              <div className={styles.titles}>
                <Text className={styles.title}>Field Security · {bucket.title}</Text>
                <Text className={styles.subtitle}>
                  Control which fields are returned by the data API.
                </Text>
              </div>
              <a
                href="https://spicaengine.com/docs/concept/bucket#rules"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon name="help" size="md" className={styles.helpIcon} />
              </a>
            </div>

            <div className={styles.tableHead}>
              <div className={`${styles.row} ${styles.headRow}`}>
                <Text className={styles.field}>Field</Text>
                <Text>Read access</Text>
                <Text>Rule</Text>
                <span />
              </div>
            </div>

            <div className={styles.table}>
              {fields.map(field => (
                <FieldSecurityRow
                  key={field.key}
                  fieldKey={field.key}
                  title={field.title}
                  acl={field.acl}
                  onEdit={handleEdit}
                />
              ))}
            </div>

            <div className={styles.legend}>
              {LEGEND_ORDER.map(status => (
                <div key={status} className={styles.legendItem}>
                  <span className={`${styles.dot} ${STATUS_META[status].dotClass}`} />
                  <Text className={styles.legendLabel}>{STATUS_META[status].label}</Text>
                  <Text className={styles.legendDescription}>
                    {STATUS_META[status].description}
                  </Text>
                </div>
              ))}
            </div>

            <div className={styles.footer}>
              <Button onClick={onClose}>
                <Icon name="check" size="sm" />
                Done
              </Button>
            </div>
          </div>
        </Modal.Body>
      </Modal>

      {editingKey && (
        <Modal
          onClose={handleCancelEdit}
          className={styles.editModal}
          isOpen
          showCloseButton={false}
        >
          <Modal.Body className={styles.editBody}>
            <FluidContainer
              direction="vertical"
              gap={0}
              prefix={{
                children: (
                  <div className={styles.editHeader}>
                    <Text className={styles.editTitle}>Read access · {editingTitle}</Text>
                  </div>
                )
              }}
              suffix={{
                children: (
                  <div className={styles.editContent}>
                    <FieldSecurityEditor
                      value={pending ?? undefined}
                      bucketProperties={bucket.properties}
                      onChange={setPending}
                    />
                    <div className={styles.editActions}>
                      <Button variant="text" onClick={handleCancelEdit} disabled={saving}>
                        <Icon name="close" size="sm" />
                        Cancel
                      </Button>
                      <Button onClick={handleSave} disabled={saving} loading={saving}>
                        <Icon name="check" size="sm" />
                        Save
                      </Button>
                    </div>
                  </div>
                )
              }}
            />
          </Modal.Body>
        </Modal>
      )}
    </>
  );
};

export default memo(FieldSecurityOverview);
