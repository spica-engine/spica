/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import {memo, useCallback, useMemo, useState} from "react";
import {
  Accordion,
  Button,
  FlexElement,
  FluidContainer,
  Icon,
  Select,
  Text,
  type TypeAccordionItem,
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

  const handleAddEnvVars = useCallback(() => {
    if (!selectedVarIds.length) return;
    const newVars = selectedVarIds
      .map(id => allEnvVars.find(v => v._id === id))
      .filter((v): v is typeof allEnvVars[number] => !!v)
      .map(v => ({_id: v._id, key: v.key, value: v.value}));
    onEnvVarsChange([...envVars, ...newVars]);
    setSelectedVarIds([]);
  }, [selectedVarIds, allEnvVars, envVars, onEnvVarsChange]);

  const handleRemoveEnvVar = useCallback(
    (envVarId: string) => {
      onEnvVarsChange(envVars.filter(v => v._id !== envVarId));
    },
    [envVars, onEnvVarsChange]
  );

  const handleAddSecrets = useCallback(() => {
    if (!selectedSecretIds.length) return;
    const newSecrets = selectedSecretIds
      .map(id => allSecrets.find(s => s._id === id))
      .filter((s): s is typeof allSecrets[number] => !!s)
      .map(s => ({_id: s._id, key: s.key}));
    onSecretsChange([...secrets, ...newSecrets]);
    setSelectedSecretIds([]);
  }, [selectedSecretIds, allSecrets, secrets, onSecretsChange]);

  const handleRemoveSecret = useCallback(
    (secretId: string) => {
      onSecretsChange(secrets.filter(s => s._id !== secretId));
    },
    [secrets, onSecretsChange]
  );

  const variablesContent = (
    <FlexElement direction="vertical" dimensionX="fill" gap={10}>
      {envVars.map(v => (
        <FluidContainer
          key={v._id}
          dimensionX="fill"
          mode="fill"
          alignment="leftCenter"
          root={{
            children: <Text size="medium">{v.key}</Text>,
            alignment: "leftCenter",
          }}
          suffix={{
            children: (
              <Button
                variant="icon"
                color="danger"
                onClick={() => handleRemoveEnvVar(v._id)}
                className={styles.button}
              >
                <Icon name="delete" />
              </Button>
            ),
          }}
        />
      ))}
      <FlexElement dimensionX="fill" gap={4} className={styles.addDependencyRow}>
        <Select
          options={envVarOptions}
          value={selectedVarIds}
          multiple
          placeholder="Select variables..."
          onChange={value => setSelectedVarIds(Array.isArray(value) ? (value as string[]) : [])}
          dimensionX="fill"
        />
        <Button
          variant="icon"
          color="default"
          onClick={handleAddEnvVars}
          disabled={!selectedVarIds.length}
        >
          <Icon name="plus" />
        </Button>
      </FlexElement>
    </FlexElement>
  );

  const secretsContent = (
    <FlexElement direction="vertical" dimensionX="fill" gap={10}>
      {secrets.map(s => (
        <FluidContainer
          key={s._id}
          dimensionX="fill"
          mode="fill"
          alignment="leftCenter"
          root={{
            children: <Text size="medium">{s.key}</Text>,
            alignment: "leftCenter",
          }}
          suffix={{
            children: (
              <Button
                variant="icon"
                color="danger"
                onClick={() => handleRemoveSecret(s._id)}
                className={styles.button}
              >
                <Icon name="delete" />
              </Button>
            ),
          }}
        />
      ))}
      <FlexElement dimensionX="fill" gap={4} className={styles.addDependencyRow}>
        <Select
          options={secretOptions}
          value={selectedSecretIds}
          multiple
          placeholder="Select secrets..."
          onChange={value => setSelectedSecretIds(Array.isArray(value) ? (value as string[]) : [])}
          dimensionX="fill"
        />
        <Button
          variant="icon"
          color="default"
          onClick={handleAddSecrets}
          disabled={!selectedSecretIds.length}
        >
          <Icon name="plus" />
        </Button>
      </FlexElement>
    </FlexElement>
  );

  const accordionItems: TypeAccordionItem[] = [
    {
      title: (
        <FlexElement gap={8} alignment="leftCenter">
          <Text size="medium">Environment</Text>
        </FlexElement>
      ),
      content: (
        <FlexElement direction="vertical" alignment="leftTop" dimensionX="fill" gap={0}>
          <div className={styles.tabsHeader}>
            <button
              className={activeTab === "variables" ? styles.tabActive : styles.tab}
              onClick={() => setActiveTab("variables")}
            >
              Variables
            </button>
            <button
              className={activeTab === "secrets" ? styles.tabActive : styles.tab}
              onClick={() => setActiveTab("secrets")}
            >
              Secrets
            </button>
          </div>
          {activeTab === "variables" ? variablesContent : secretsContent}
        </FlexElement>
      ),
    },
  ];

  return (
    <Accordion
      items={accordionItems}
      suffixOnHover={false}
      noBackgroundOnFocus
    />
  );
};

export default memo(EnvironmentPanel);
