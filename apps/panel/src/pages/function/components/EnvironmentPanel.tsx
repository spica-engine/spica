/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import {memo, useCallback, useMemo, useState} from "react";
import {
  Button,
  FlexElement,
  Icon,
  Select,
} from "oziko-ui-kit";
import type {TypeLabeledValue} from "oziko-ui-kit";
import type {ResolvedEnvVar, ResolvedSecret} from "../../../store/api/functionApi";
import {useGetEnvVarsQuery} from "../../../store/api/envVarApi";
import {useGetSecretsQuery} from "../../../store/api/secretApi";
import styles from "./EnvironmentPanel.module.scss";

type TabKey = "variables" | "secrets";

type EnvironmentPanelProps = {
  envVars: ResolvedEnvVar[];
  secrets: ResolvedSecret[];
  onEnvVarsChange: (envVars: ResolvedEnvVar[]) => void;
  onSecretsChange: (secrets: ResolvedSecret[]) => void;
};

const EnvironmentPanel = ({envVars, secrets, onEnvVarsChange, onSecretsChange}: EnvironmentPanelProps) => {
  const [activeTab, setActiveTab] = useState<TabKey>("variables");
  const [selectedVarIds, setSelectedVarIds] = useState<string[]>([]);
  const [selectedSecretIds, setSelectedSecretIds] = useState<string[]>([]);

  const {data: envVarsResponse} = useGetEnvVarsQuery();
  const {data: secretsResponse} = useGetSecretsQuery();

  const allEnvVars = envVarsResponse?.data ?? [];
  const allSecrets = secretsResponse?.data ?? [];

  const assignedEnvVarIdSet = useMemo(
    () => new Set(envVars.map(v => v._id)),
    [envVars]
  );

  const assignedSecretIdSet = useMemo(
    () => new Set(secrets.map(s => s._id)),
    [secrets]
  );

  const envVarOptions = useMemo<TypeLabeledValue[]>(
    () =>
      allEnvVars
        .filter(v => !assignedEnvVarIdSet.has(v._id))
        .map(v => ({value: v._id, label: v.key})),
    [allEnvVars, assignedEnvVarIdSet]
  );

  const secretOptions = useMemo<TypeLabeledValue[]>(
    () =>
      allSecrets
        .filter(s => !assignedSecretIdSet.has(s._id))
        .map(s => ({value: s._id, label: s.key})),
    [allSecrets, assignedSecretIdSet]
  );

  const handleAddEnvVars = useCallback((ids: string[]) => {
    if (!ids.length) return;
    const newVars = ids
      .map(id => allEnvVars.find(v => v._id === id))
      .filter((v): v is typeof allEnvVars[number] => !!v)
      .map(v => ({_id: v._id, key: v.key, value: v.value}));
    onEnvVarsChange([...envVars, ...newVars]);
    setSelectedVarIds([]);
  }, [allEnvVars, envVars, onEnvVarsChange]);

  const handleRemoveEnvVar = useCallback(
    (envVarId: string) => {
      onEnvVarsChange(envVars.filter(v => v._id !== envVarId));
    },
    [envVars, onEnvVarsChange]
  );

  const handleAddSecrets = useCallback((ids: string[]) => {
    if (!ids.length) return;
    const newSecrets = ids
      .map(id => allSecrets.find(s => s._id === id))
      .filter((s): s is typeof allSecrets[number] => !!s)
      .map(s => ({_id: s._id, key: s.key}));
    onSecretsChange([...secrets, ...newSecrets]);
    setSelectedSecretIds([]);
  }, [allSecrets, secrets, onSecretsChange]);

  const handleRemoveSecret = useCallback(
    (secretId: string) => {
      onSecretsChange(secrets.filter(s => s._id !== secretId));
    },
    [secrets, onSecretsChange]
  );

  const variablesContent = (
    <FlexElement direction="vertical" dimensionX="fill" gap={8}>
      <FlexElement dimensionX="fill" gap={4} className={styles.addDependencyRow}>
        <Select
          options={envVarOptions}
          value={selectedVarIds}
          multiple
          placeholder="Select variables to add..."
          onChange={value => {
            const ids = Array.isArray(value) ? (value as string[]) : [];
            setSelectedVarIds(ids);
            if (ids.length) handleAddEnvVars(ids);
          }}
          dimensionX="fill"
        />
      </FlexElement>
      {envVars.length === 0 ? (
        <div className={styles.emptyState}>
          <Icon name="key" size="md" />
          <span>No variables assigned</span>
        </div>
      ) : (
        <div className={styles.itemList}>
          {envVars.map(v => (
            <div key={v._id} className={styles.varItem}>
              <span className={styles.varKey}>{v.key}</span>
              <div className={styles.varActions}>
                <Button
                  variant="icon"
                  color="danger"
                  onClick={() => handleRemoveEnvVar(v._id)}
                  className={styles.button}
                >
                  <Icon name="delete" size="sm" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </FlexElement>
  );

  const secretsContent = (
    <FlexElement direction="vertical" dimensionX="fill" gap={8}>
      <FlexElement dimensionX="fill" gap={4} className={styles.addDependencyRow}>
        <Select
          options={secretOptions}
          value={selectedSecretIds}
          multiple
          placeholder="Select secrets to add..."
          onChange={value => {
            const ids = Array.isArray(value) ? (value as string[]) : [];
            setSelectedSecretIds(ids);
            if (ids.length) handleAddSecrets(ids);
          }}
          dimensionX="fill"
        />
      </FlexElement>
      {secrets.length === 0 ? (
        <div className={styles.emptyState}>
          <Icon name="lock" size="md" />
          <span>No secrets assigned</span>
        </div>
      ) : (
        <div className={styles.itemList}>
          {secrets.map(s => (
            <div key={s._id} className={styles.varItem}>
              <span className={styles.varKey}>{s.key}</span>
              <div className={styles.varActions}>
                <Button
                  variant="icon"
                  color="danger"
                  onClick={() => handleRemoveSecret(s._id)}
                  className={styles.button}
                >
                  <Icon name="delete" size="sm" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </FlexElement>
  );

  return (
    <FlexElement direction="vertical" alignment="leftTop" dimensionX="fill" gap={0}>
      <div className={styles.tabsHeader}>
        <button
          className={activeTab === "variables" ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab("variables")}
        >
          Variables
          {envVars.length > 0 && <span className={styles.tabCount}>{envVars.length}</span>}
        </button>
        <button
          className={activeTab === "secrets" ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab("secrets")}
        >
          Secrets
          {secrets.length > 0 && <span className={styles.tabCount}>{secrets.length}</span>}
        </button>
      </div>
      {activeTab === "variables" ? variablesContent : secretsContent}
    </FlexElement>
  );
};

export default memo(EnvironmentPanel);
