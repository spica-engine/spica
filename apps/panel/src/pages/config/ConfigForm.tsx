import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Checkbox,
  FlexElement,
  Icon,
  Select,
  StringInput,
  Text,
} from "oziko-ui-kit";
import { useUpdateConfigMutation } from "../../store/api/configApi";
import type { ConfigItem } from "../../store/api/configApi";
import styles from "./Config.module.scss";

type ConfigFormProps = {
  isOpen: boolean;
  selectedConfig: ConfigItem | null;
  onClose: () => void;
};

const RATE_LIMIT_KEYS = ["login", "providerVerification", "forgotPassword", "refreshToken", "createUser"] as const;
const PROVIDER_ENUM = ["email", "phone"] as const;
const STRATEGY_ENUM = ["Otp", "MagicLink"] as const;

type ProviderItem = { provider: string; strategy: string };
type RateLimitItem = { limit: number; ttl: number };

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function getInitialOptions(config: ConfigItem | null): Record<string, unknown> {
  if (!config?.options) return {};
  return JSON.parse(JSON.stringify(config.options));
}

const ConfigForm = ({ isOpen, selectedConfig, onClose }: ConfigFormProps) => {
  const [options, setOptions] = useState<Record<string, unknown>>({});
  const [baseline, setBaseline] = useState<Record<string, unknown>>({});
  const [updateConfig, { isLoading: isSaving }] = useUpdateConfigMutation();

  useEffect(() => {
    if (isOpen && selectedConfig) {
      const initial = getInitialOptions(selectedConfig);
      setOptions(initial);
      setBaseline(initial);
    } else {
      setOptions({});
      setBaseline({});
    }
  }, [isOpen, selectedConfig]);

  const hasChanges = useMemo(() => !deepEqual(options, baseline), [options, baseline]);

  const handleSave = useCallback(async () => {
    if (!selectedConfig || !hasChanges) return;
    try {
      await updateConfig({ module: selectedConfig.module, options }).unwrap();
      onClose();
    } catch {
      // Error handled by mutation
    }
  }, [selectedConfig, options, hasChanges, updateConfig, onClose]);

  const handleCancel = useCallback(() => {
    setOptions(getInitialOptions(selectedConfig));
    onClose();
  }, [selectedConfig, onClose]);

  const updateOption = useCallback((key: string, value: unknown) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  }, []);

  if (!selectedConfig) return null;

  return (
    <div className={styles.drawerForm}>
      <FlexElement
        dimensionX="fill"
        direction="vertical"
        alignment="leftTop"
        gap={10}
        className={styles.drawerContent}
      >
        <Text className={styles.drawerTitle}>
          Edit Configuration: <strong style={{ textTransform: "capitalize" }}>{selectedConfig.module}</strong>
        </Text>

        {selectedConfig.module === "versioncontrol" && (
          <VersionControlFields options={options} updateOption={updateOption} />
        )}

        {selectedConfig.module === "user" && (
          <UserFields options={options} setOptions={setOptions} />
        )}

        {selectedConfig.module === "identity" && (
          <IdentityFields options={options} setOptions={setOptions} />
        )}

        {!["versioncontrol", "user", "identity"].includes(selectedConfig.module) && (
          <GenericFields options={options} setOptions={setOptions} />
        )}
      </FlexElement>

      <FlexElement
        dimensionX="fill"
        alignment="rightCenter"
        direction="horizontal"
        gap={10}
        className={styles.drawerActions}
      >
        <Button variant="solid" color="danger" type="button" onClick={handleCancel}>
          <Icon name="close" />
          Cancel
        </Button>
        <Button
          variant="solid"
          color="primary"
          type="button"
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
        >
          <Icon name="check" />
          Save
        </Button>
      </FlexElement>
    </div>
  );
};

type FieldProps = {
  options: Record<string, unknown>;
  updateOption: (key: string, value: unknown) => void;
};

type SetOptionsFieldProps = {
  options: Record<string, unknown>;
  setOptions: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
};

const VersionControlFields = ({ options, updateOption }: FieldProps) => {
  const autoApproveSync = (options.autoApproveSync ?? {}) as Record<string, boolean>;

  const handleToggle = (key: string) => {
    updateOption("autoApproveSync", {
      ...autoApproveSync,
      [key]: !autoApproveSync[key],
    });
  };

  return (
    <FlexElement dimensionX="fill" direction="vertical" gap={10}>
      <Text className={styles.sectionTitle}>Auto Approve Sync</Text>
      <FlexElement dimensionX="fill" alignment="leftCenter" gap={8}>
        <Checkbox
          checked={!!autoApproveSync.document}
          onChange={() => handleToggle("document")}
        />
        <Text>Document</Text>
      </FlexElement>
      <FlexElement dimensionX="fill" alignment="leftCenter" gap={8}>
        <Checkbox
          checked={!!autoApproveSync.representative}
          onChange={() => handleToggle("representative")}
        />
        <Text>Representative</Text>
      </FlexElement>
    </FlexElement>
  );
};

const UserFields = ({ options, setOptions }: SetOptionsFieldProps) => {
  const rateLimits = (options.rateLimits ?? {}) as Record<string, RateLimitItem>;

  const updateRateLimit = (category: string, field: "limit" | "ttl", value: string) => {
    const numVal = parseInt(value, 10);
    if (isNaN(numVal) && value !== "") return;
    setOptions((prev) => ({
      ...prev,
      rateLimits: {
        ...(prev.rateLimits as Record<string, RateLimitItem> ?? {}),
        [category]: {
          ...((prev.rateLimits as Record<string, RateLimitItem> ?? {})[category] ?? { limit: 0, ttl: 0 }),
          [field]: value === "" ? 0 : numVal,
        },
      },
    }));
  };

  const verificationMaxAttempt = (options.verificationProcessMaxAttempt as number) ?? 0;

  const updateMaxAttempt = (value: string) => {
    const numVal = parseInt(value, 10);
    setOptions((prev) => ({
      ...prev,
      verificationProcessMaxAttempt: isNaN(numVal) ? 0 : numVal,
    }));
  };

  const providerVerificationConfig = (options.providerVerificationConfig ?? []) as ProviderItem[];

  const updateProviderConfig = (index: number, field: "provider" | "strategy", value: string) => {
    setOptions((prev) => {
      const list = [...((prev.providerVerificationConfig ?? []) as ProviderItem[])];
      list[index] = { ...list[index], [field]: value };
      return { ...prev, providerVerificationConfig: list };
    });
  };

  const addProviderConfig = () => {
    setOptions((prev) => ({
      ...prev,
      providerVerificationConfig: [
        ...((prev.providerVerificationConfig ?? []) as ProviderItem[]),
        { provider: "email", strategy: "Otp" },
      ],
    }));
  };

  const removeProviderConfig = (index: number) => {
    setOptions((prev) => ({
      ...prev,
      providerVerificationConfig: ((prev.providerVerificationConfig ?? []) as ProviderItem[]).filter(
        (_, i) => i !== index
      ),
    }));
  };

  const passwordlessLogin = (options.passwordlessLogin ?? {}) as {
    passwordlessLoginProvider?: ProviderItem[];
  };
  const passwordlessProviders = passwordlessLogin.passwordlessLoginProvider ?? [];

  const updatePasswordlessProvider = (index: number, field: "provider" | "strategy", value: string) => {
    setOptions((prev) => {
      const pl = (prev.passwordlessLogin ?? {}) as { passwordlessLoginProvider?: ProviderItem[] };
      const list = [...(pl.passwordlessLoginProvider ?? [])];
      list[index] = { ...list[index], [field]: value };
      return { ...prev, passwordlessLogin: { ...pl, passwordlessLoginProvider: list } };
    });
  };

  const addPasswordlessProvider = () => {
    setOptions((prev) => {
      const pl = (prev.passwordlessLogin ?? {}) as { passwordlessLoginProvider?: ProviderItem[] };
      return {
        ...prev,
        passwordlessLogin: {
          ...pl,
          passwordlessLoginProvider: [...(pl.passwordlessLoginProvider ?? []), { provider: "email", strategy: "" }],
        },
      };
    });
  };

  const removePasswordlessProvider = (index: number) => {
    setOptions((prev) => {
      const pl = (prev.passwordlessLogin ?? {}) as { passwordlessLoginProvider?: ProviderItem[] };
      return {
        ...prev,
        passwordlessLogin: {
          ...pl,
          passwordlessLoginProvider: (pl.passwordlessLoginProvider ?? []).filter((_, i) => i !== index),
        },
      };
    });
  };

  const resetPasswordProvider = (options.resetPasswordProvider ?? []) as ProviderItem[];

  const updateResetProvider = (index: number, field: "provider" | "strategy", value: string) => {
    setOptions((prev) => {
      const list = [...((prev.resetPasswordProvider ?? []) as ProviderItem[])];
      list[index] = { ...list[index], [field]: value };
      return { ...prev, resetPasswordProvider: list };
    });
  };

  const addResetProvider = () => {
    setOptions((prev) => ({
      ...prev,
      resetPasswordProvider: [
        ...((prev.resetPasswordProvider ?? []) as ProviderItem[]),
        { provider: "email", strategy: "" },
      ],
    }));
  };

  const removeResetProvider = (index: number) => {
    setOptions((prev) => ({
      ...prev,
      resetPasswordProvider: ((prev.resetPasswordProvider ?? []) as ProviderItem[]).filter(
        (_, i) => i !== index
      ),
    }));
  };

  const providerOptions = PROVIDER_ENUM.map((p) => ({ label: p, value: p }));
  const strategyOptions = STRATEGY_ENUM.map((s) => ({ label: s, value: s }));

  return (
    <FlexElement dimensionX="fill" direction="vertical" gap={12}>
      <FlexElement dimensionX="fill" direction="vertical" gap={4}>
        <Text className={styles.sectionTitle}>Verification Max Attempts</Text>
        <StringInput
          label="Max Attempts"
          value={String(verificationMaxAttempt)}
          onChange={(v) => updateMaxAttempt(v)}
        />
      </FlexElement>

      <Text className={styles.sectionTitle}>Rate Limits</Text>
      {RATE_LIMIT_KEYS.map((category) => {
        const rl = rateLimits[category] ?? { limit: 0, ttl: 0 };
        return (
          <FlexElement key={category} dimensionX="fill" direction="horizontal" gap={8} className={styles.rateLimitRow}>
            <Text className={styles.rateLimitLabel}>{category.replace(/([A-Z])/g, " $1")}</Text>
            <StringInput
              label="Limit"
              value={String(rl.limit ?? 0)}
              onChange={(v) => updateRateLimit(category, "limit", v)}
            />
            <StringInput
              label="TTL (s)"
              value={String(rl.ttl ?? 0)}
              onChange={(v) => updateRateLimit(category, "ttl", v)}
            />
          </FlexElement>
        );
      })}

      <Text className={styles.sectionTitle}>Provider Verification Config</Text>
      {providerVerificationConfig.map((item, index) => (
        <FlexElement key={index} dimensionX="fill" direction="horizontal" gap={8} className={styles.providerRow}>
          <Select
            dimensionX="fill"
            dimensionY={36}
            options={providerOptions}
            value={item.provider}
            onChange={(v) => updateProviderConfig(index, "provider", v as string)}
            placeholder="Provider"
          />
          <Select
            dimensionX="fill"
            dimensionY={36}
            options={strategyOptions}
            value={item.strategy}
            onChange={(v) => updateProviderConfig(index, "strategy", v as string)}
            placeholder="Strategy"
          />
          <Button variant="icon" color="danger" onClick={() => removeProviderConfig(index)} className={styles.removeButton}>
            <Icon name="close" />
          </Button>
        </FlexElement>
      ))}
      <Button variant="text" color="primary" onClick={addProviderConfig} className={styles.addButton}>
        <Icon name="plus" /> Add Provider
      </Button>

      <Text className={styles.sectionTitle}>Passwordless Login Providers</Text>
      {passwordlessProviders.map((item, index) => (
        <FlexElement key={index} dimensionX="fill" direction="horizontal" gap={8} className={styles.providerRow}>
          <Select
            dimensionX="fill"
            dimensionY={36}
            options={providerOptions}
            value={item.provider}
            onChange={(v) => updatePasswordlessProvider(index, "provider", v as string)}
            placeholder="Provider"
          />
          <StringInput
            label="Strategy"
            value={item.strategy}
            onChange={(v) => updatePasswordlessProvider(index, "strategy", v)}
          />
          <Button variant="icon" color="danger" onClick={() => removePasswordlessProvider(index)} className={styles.removeButton}>
            <Icon name="close" />
          </Button>
        </FlexElement>
      ))}
      <Button variant="text" color="primary" onClick={addPasswordlessProvider} className={styles.addButton}>
        <Icon name="plus" /> Add Provider
      </Button>

      <Text className={styles.sectionTitle}>Reset Password Providers</Text>
      {resetPasswordProvider.map((item, index) => (
        <FlexElement key={index} dimensionX="fill" direction="horizontal" gap={8} className={styles.providerRow}>
          <Select
            dimensionX="fill"
            dimensionY={36}
            options={providerOptions}
            value={item.provider}
            onChange={(v) => updateResetProvider(index, "provider", v as string)}
            placeholder="Provider"
          />
          <StringInput
            label="Strategy"
            value={item.strategy}
            onChange={(v) => updateResetProvider(index, "strategy", v)}
          />
          <Button variant="icon" color="danger" onClick={() => removeResetProvider(index)} className={styles.removeButton}>
            <Icon name="close" />
          </Button>
        </FlexElement>
      ))}
      <Button variant="text" color="primary" onClick={addResetProvider} className={styles.addButton}>
        <Icon name="plus" /> Add Provider
      </Button>
    </FlexElement>
  );
};

const IdentityFields = ({ options, setOptions }: SetOptionsFieldProps) => {
  const keys = Object.keys(options);

  const handleChange = (key: string, value: string) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  };

  const handleAdd = () => {
    const newKey = `option_${keys.length + 1}`;
    setOptions((prev) => ({ ...prev, [newKey]: "" }));
  };

  const handleRemove = (key: string) => {
    setOptions((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  return (
    <FlexElement dimensionX="fill" direction="vertical" gap={10}>
      <Text className={styles.sectionTitle}>Identity Options</Text>
      {keys.length === 0 && <Text>No options configured yet.</Text>}
      {keys.map((key) => (
        <FlexElement key={key} dimensionX="fill" direction="horizontal" gap={8} className={styles.providerRow}>
          <Text style={{ minWidth: 120 }}>{key}</Text>
          <StringInput
            label="Value"
            value={String(options[key] ?? "")}
            onChange={(v) => handleChange(key, v)}
          />
          <Button variant="icon" color="danger" onClick={() => handleRemove(key)} className={styles.removeButton}>
            <Icon name="close" />
          </Button>
        </FlexElement>
      ))}
      <Button variant="text" color="primary" onClick={handleAdd} className={styles.addButton}>
        <Icon name="plus" /> Add Option
      </Button>
    </FlexElement>
  );
};

const GenericFields = ({ options, setOptions }: SetOptionsFieldProps) => {
  const keys = Object.keys(options);

  const handleChange = (key: string, value: string) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <FlexElement dimensionX="fill" direction="vertical" gap={10}>
      <Text className={styles.sectionTitle}>Options</Text>
      {keys.length === 0 && <Text>No options configured.</Text>}
      {keys.map((key) => (
        <FlexElement key={key} dimensionX="fill" direction="vertical" gap={4}>
          <StringInput
            label={key}
            value={String(options[key] ?? "")}
            onChange={(v) => handleChange(key, v)}
          />
        </FlexElement>
      ))}
    </FlexElement>
  );
};

export default ConfigForm;
