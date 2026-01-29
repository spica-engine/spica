/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import { useEffect } from "react";
import { moduleDataRegistry, moduleRendererRegistry, type ModuleDataProvider } from "./moduleRenderers";
import { resourceRendererRegistry } from "./resourceRenderers";

import { BucketModuleRenderer } from "./modules/BucketModuleRenderer";
import { ApiKeyModuleRenderer } from "./modules/ApiKeyModuleRenderer";
import { DashboardModuleRenderer } from "./modules/DashboardModuleRenderer";
import { FunctionModuleRenderer } from "./modules/FunctionModuleRenderer";
import { IdentityModuleRenderer } from "./modules/IdentityModuleRenderer";
import { WebhookModuleRenderer } from "./modules/WebhookModuleRenderer";
import { PolicyModuleRenderer } from "./modules/PolicyModuleRenderer";
import { ActivityModuleRenderer } from "./modules/ActivityModuleRenderer";
import { AssetsModuleRenderer } from "./modules/AssetsModuleRenderer";
import { AuthenticationStrategyModuleRenderer } from "./modules/AuthenticationStrategyModuleRenderer";
import { FunctionLogsModuleRenderer } from "./modules/FunctionLogsModuleRenderer";
import { WebhookLogsModuleRenderer } from "./modules/WebhookLogsModuleRenderer";
import { PreferenceModuleRenderer, type PreferenceResourceItem } from "./modules/PreferenceModuleRenderer";
import { StatusModuleRenderer, type StatusResourceItem } from "./modules/StatusModuleRenderer";

import { BucketResourceRenderer } from "./resources/BucketResourceRenderer";
import type { BucketType } from "../../store/api/bucketApi";
import { useGetBucketsQuery } from "../../store/api/bucketApi";
import { useGetApiKeysQuery, type ApiKey } from "../../store/api/apiKeyApi";
import { useGetDashboardsQuery, type Dashboard } from "../../store/api/dashboardApi";
import { useGetFunctionsQuery, type SpicaFunction } from "../../store/api/functionApi";
import { useGetIdentitiesQuery, type Identity } from "../../store/api/identityApi";
import { useGetPoliciesQuery, type Policy } from "../../store/api/policyApi";
import { useGetWebhooksQuery, type Webhook } from "../../store/api/webhookApi";
import { useGetAuthenticationStrategiesQuery, type AuthenticationStrategy } from "../../store/api/authenticationStrategy";

type BucketModuleExtras = {
  moduleData?: Record<string, unknown>;
  onResourceChange?: (
    module: string,
    actionName: string,
    bucketId: string,
    type: "include" | "exclude",
    checked: boolean
  ) => void;
  onResourceBatchChange?: (
    module: string,
    actionName: string,
    changes: Array<{resourceId: string; type: "include" | "exclude"; checked: boolean}>
  ) => void;
};

type ApiKeyModuleExtras = {
  moduleData?: Record<string, unknown>;
  onResourceChange?: (
    module: string,
    actionName: string,
    apiKeyId: string,
    type: "include" | "exclude",
    checked: boolean
  ) => void;
  onResourceBatchChange?: (
    module: string,
    actionName: string,
    changes: Array<{resourceId: string; type: "include" | "exclude"; checked: boolean}>
  ) => void;
};

type PolicyModuleExtras = {
  moduleData?: Record<string, unknown>;
  onResourceChange?: (
    module: string,
    actionName: string,
    policyId: string,
    type: "include" | "exclude",
    checked: boolean
  ) => void;
  onResourceBatchChange?: (
    module: string,
    actionName: string,
    changes: Array<{resourceId: string; type: "include" | "exclude"; checked: boolean}>
  ) => void;
};

type DashboardModuleExtras = {
  moduleData?: Record<string, unknown>;
  onResourceChange?: (
    module: string,
    actionName: string,
    dashboardId: string,
    type: "include" | "exclude",
    checked: boolean
  ) => void;
  onResourceBatchChange?: (
    module: string,
    actionName: string,
    changes: Array<{resourceId: string; type: "include" | "exclude"; checked: boolean}>
  ) => void;
};

type FunctionModuleExtras = {
  moduleData?: Record<string, unknown>;
  onResourceChange?: (
    module: string,
    actionName: string,
    functionId: string,
    type: "include" | "exclude",
    checked: boolean
  ) => void;
  onResourceBatchChange?: (
    module: string,
    actionName: string,
    changes: Array<{resourceId: string; type: "include" | "exclude"; checked: boolean}>
  ) => void;
};

type IdentityModuleExtras = {
  moduleData?: Record<string, unknown>;
  onResourceChange?: (
    module: string,
    actionName: string,
    identityId: string,
    type: "include" | "exclude",
    checked: boolean
  ) => void;
  onResourceBatchChange?: (
    module: string,
    actionName: string,
    changes: Array<{resourceId: string; type: "include" | "exclude"; checked: boolean}>
  ) => void;
};

type WebhookModuleExtras = {
  moduleData?: Record<string, unknown>;
  onResourceChange?: (
    module: string,
    actionName: string,
    webhookId: string,
    type: "include" | "exclude",
    checked: boolean
  ) => void;
  onResourceBatchChange?: (
    module: string,
    actionName: string,
    changes: Array<{resourceId: string; type: "include" | "exclude"; checked: boolean}>
  ) => void;
};

type AuthenticationStrategyModuleExtras = {
  moduleData?: Record<string, unknown>;
  onResourceChange?: (
    module: string,
    actionName: string,
    strategyId: string,
    type: "include" | "exclude",
    checked: boolean
  ) => void;
  onResourceBatchChange?: (
    module: string,
    actionName: string,
    changes: Array<{resourceId: string; type: "include" | "exclude"; checked: boolean}>
  ) => void;
};

type PreferenceModuleExtras = {
  moduleData?: Record<string, unknown>;
  onResourceChange?: (
    module: string,
    actionName: string,
    preferenceId: string,
    type: "include" | "exclude",
    checked: boolean
  ) => void;
  onResourceBatchChange?: (
    module: string,
    actionName: string,
    changes: Array<{resourceId: string; type: "include" | "exclude"; checked: boolean}>
  ) => void;
};

type StatusModuleExtras = {
  moduleData?: Record<string, unknown>;
  onResourceChange?: (
    module: string,
    actionName: string,
    statusResourceId: string,
    type: "include" | "exclude",
    checked: boolean
  ) => void;
  onResourceBatchChange?: (
    module: string,
    actionName: string,
    changes: Array<{resourceId: string; type: "include" | "exclude"; checked: boolean}>
  ) => void;
};


const BucketModuleDataProvider: ModuleDataProvider = ({ onData }) => {
  const { data: buckets = [] } = useGetBucketsQuery();

  useEffect(() => {
    onData({ buckets });
  }, [buckets, onData]);

  return null;
};

const ApiKeyModuleDataProvider: ModuleDataProvider = ({ onData }) => {
  const { data } = useGetApiKeysQuery();
  const apiKeys = data?.data ?? [];

  useEffect(() => {
    onData({ apiKeys });
  }, [apiKeys, onData]);

  return null;
};

const PolicyModuleDataProvider: ModuleDataProvider = ({ onData }) => {
  const { data: policies = [] } = useGetPoliciesQuery();

  useEffect(() => {
    onData({ policies });
  }, [policies, onData]);

  return null;
};

const DashboardModuleDataProvider: ModuleDataProvider = ({ onData }) => {
  const { data: dashboards = [] } = useGetDashboardsQuery();

  useEffect(() => {
    onData({ dashboards });
  }, [dashboards, onData]);

  return null;
};

const FunctionModuleDataProvider: ModuleDataProvider = ({ onData }) => {
  const { data: functions = [] } = useGetFunctionsQuery();

  useEffect(() => {
    onData({ functions });
  }, [functions, onData]);

  return null;
};

const IdentityModuleDataProvider: ModuleDataProvider = ({ onData }) => {
  const { data: identities = [] } = useGetIdentitiesQuery();

  useEffect(() => {
    onData({ identities });
  }, [identities, onData]);

  return null;
};

const WebhookModuleDataProvider: ModuleDataProvider = ({ onData }) => {
  const { data } = useGetWebhooksQuery();
  const webhooks = data?.data ?? [];

  useEffect(() => {
    onData({ webhooks });
  }, [webhooks, onData]);

  return null;
};

const AuthenticationStrategyModuleDataProvider: ModuleDataProvider = ({ onData }) => {
  const { data: strategies = [] } = useGetAuthenticationStrategiesQuery();

  useEffect(() => {
    onData({ strategies });
  }, [strategies, onData]);

  return null;
};

const PreferenceModuleDataProvider: ModuleDataProvider = ({ onData }) => {
  useEffect(() => {
    onData({
      preferences: [
        { title: "Preference", value: "preference" },
        { title: "All Resources", value: "*" }
      ]
    });
  }, [onData]);

  return null;
};

const StatusModuleDataProvider: ModuleDataProvider = ({ onData }) => {
  useEffect(() => {
    onData({
      statusResources: [
        { title: "Bucket", value: "bucket" },
        { title: "Identity", value: "identity" },
        { title: "Storage", value: "storage" },
        { title: "Function", value: "function" },
        { title: "API", value: "api" },
        { title: "All Resources", value: "*" }
      ]
    });
  }, [onData]);

  return null;
};

export function registerAllRenderers(): void {
  if (registerAllRenderers.registered) return;
  registerAllRenderers.registered = true;

  moduleRendererRegistry.register("bucket", new BucketModuleRenderer(), (baseContext, extras) => {
    const { moduleData, onResourceChange, onResourceBatchChange } = extras as BucketModuleExtras;
    const moduleName = baseContext.moduleStatement.module;
    const bucketData = moduleData?.[moduleName] as { buckets?: BucketType[] } | undefined;
    return {
      ...baseContext,
      buckets: bucketData?.buckets,
      onResourceChange: onResourceChange
        ? (actionName: string, bucketId: string, type: "include" | "exclude", checked: boolean) =>
            onResourceChange(moduleName, actionName, bucketId, type, checked)
        : undefined,
      onResourceBatchChange: onResourceBatchChange
        ? (actionName: string, changes: Array<{resourceId: string; type: "include" | "exclude"; checked: boolean}>) =>
            onResourceBatchChange(moduleName, actionName, changes)
        : undefined
    };
  });
  moduleRendererRegistry.register("passport:apikey", new ApiKeyModuleRenderer(), (baseContext, extras) => {
    const { moduleData, onResourceChange, onResourceBatchChange } = extras as ApiKeyModuleExtras;
    const moduleName = baseContext.moduleStatement.module;
    const apiKeyData = moduleData?.[moduleName] as { apiKeys?: ApiKey[] } | undefined;
    return {
      ...baseContext,
      apiKeys: apiKeyData?.apiKeys,
      onResourceChange: onResourceChange
        ? (actionName: string, apiKeyId: string, type: "include" | "exclude", checked: boolean) =>
            onResourceChange(moduleName, actionName, apiKeyId, type, checked)
        : undefined,
      onResourceBatchChange: onResourceBatchChange
        ? (actionName: string, changes: Array<{resourceId: string; type: "include" | "exclude"; checked: boolean}>) =>
            onResourceBatchChange(moduleName, actionName, changes)
        : undefined
    };
  });
  moduleRendererRegistry.register("passport:policy", new PolicyModuleRenderer(), (baseContext, extras) => {
    const { moduleData, onResourceChange, onResourceBatchChange } = extras as PolicyModuleExtras;
    const moduleName = baseContext.moduleStatement.module;
    const policyData = moduleData?.[moduleName] as { policies?: Policy[] } | undefined;
    return {
      ...baseContext,
      policies: policyData?.policies,
      onResourceChange: onResourceChange
        ? (actionName: string, policyId: string, type: "include" | "exclude", checked: boolean) =>
            onResourceChange(moduleName, actionName, policyId, type, checked)
        : undefined,
      onResourceBatchChange: onResourceBatchChange
        ? (actionName: string, changes: Array<{resourceId: string; type: "include" | "exclude"; checked: boolean}>) =>
            onResourceBatchChange(moduleName, actionName, changes)
        : undefined
    };
  });
  moduleRendererRegistry.register("activity", new ActivityModuleRenderer());
  moduleRendererRegistry.register("asset", new AssetsModuleRenderer());
  moduleRendererRegistry.register("function:logs", new FunctionLogsModuleRenderer());
  moduleRendererRegistry.register("webhook:logs", new WebhookLogsModuleRenderer());
  moduleRendererRegistry.register("dashboard", new DashboardModuleRenderer(), (baseContext, extras) => {
    const { moduleData, onResourceChange, onResourceBatchChange } = extras as DashboardModuleExtras;
    const moduleName = baseContext.moduleStatement.module;
    const dashboardData = moduleData?.[moduleName] as { dashboards?: Dashboard[] } | undefined;
    return {
      ...baseContext,
      dashboards: dashboardData?.dashboards,
      onResourceChange: onResourceChange
        ? (actionName: string, dashboardId: string, type: "include" | "exclude", checked: boolean) =>
            onResourceChange(moduleName, actionName, dashboardId, type, checked)
        : undefined,
      onResourceBatchChange: onResourceBatchChange
        ? (actionName: string, changes: Array<{resourceId: string; type: "include" | "exclude"; checked: boolean}>) =>
            onResourceBatchChange(moduleName, actionName, changes)
        : undefined
    };
  });
  moduleRendererRegistry.register("function", new FunctionModuleRenderer(), (baseContext, extras) => {
    const { moduleData, onResourceChange, onResourceBatchChange } = extras as FunctionModuleExtras;
    const moduleName = baseContext.moduleStatement.module;
    const functionData = moduleData?.[moduleName] as { functions?: SpicaFunction[] } | undefined;
    return {
      ...baseContext,
      functions: functionData?.functions,
      onResourceChange: onResourceChange
        ? (actionName: string, functionId: string, type: "include" | "exclude", checked: boolean) =>
            onResourceChange(moduleName, actionName, functionId, type, checked)
        : undefined,
      onResourceBatchChange: onResourceBatchChange
        ? (actionName: string, changes: Array<{resourceId: string; type: "include" | "exclude"; checked: boolean}>) =>
            onResourceBatchChange(moduleName, actionName, changes)
        : undefined
    };
  });
  moduleRendererRegistry.register("passport:identity", new IdentityModuleRenderer(), (baseContext, extras) => {
    const { moduleData, onResourceChange, onResourceBatchChange } = extras as IdentityModuleExtras;
    const moduleName = baseContext.moduleStatement.module;
    const identityData = moduleData?.[moduleName] as { identities?: Identity[] } | undefined;
    return {
      ...baseContext,
      identities: identityData?.identities,
      onResourceChange: onResourceChange
        ? (actionName: string, identityId: string, type: "include" | "exclude", checked: boolean) =>
            onResourceChange(moduleName, actionName, identityId, type, checked)
        : undefined,
      onResourceBatchChange: onResourceBatchChange
        ? (actionName: string, changes: Array<{resourceId: string; type: "include" | "exclude"; checked: boolean}>) =>
            onResourceBatchChange(moduleName, actionName, changes)
        : undefined
    };
  });
  moduleRendererRegistry.register("webhook", new WebhookModuleRenderer(), (baseContext, extras) => {
    const { moduleData, onResourceChange, onResourceBatchChange } = extras as WebhookModuleExtras;
    const moduleName = baseContext.moduleStatement.module;
    const webhookData = moduleData?.[moduleName] as { webhooks?: Webhook[] } | undefined;
    return {
      ...baseContext,
      webhooks: webhookData?.webhooks,
      onResourceChange: onResourceChange
        ? (actionName: string, webhookId: string, type: "include" | "exclude", checked: boolean) =>
            onResourceChange(moduleName, actionName, webhookId, type, checked)
        : undefined,
      onResourceBatchChange: onResourceBatchChange
        ? (actionName: string, changes: Array<{resourceId: string; type: "include" | "exclude"; checked: boolean}>) =>
            onResourceBatchChange(moduleName, actionName, changes)
        : undefined
    };
  });
  moduleRendererRegistry.register("passport:strategy", new AuthenticationStrategyModuleRenderer(), (baseContext, extras) => {
    const { moduleData, onResourceChange, onResourceBatchChange } = extras as AuthenticationStrategyModuleExtras;
    const moduleName = baseContext.moduleStatement.module;
    const strategyData = moduleData?.[moduleName] as { strategies?: AuthenticationStrategy[] } | undefined;
    return {
      ...baseContext,
      strategies: strategyData?.strategies,
      onResourceChange: onResourceChange
        ? (actionName: string, strategyId: string, type: "include" | "exclude", checked: boolean) =>
            onResourceChange(moduleName, actionName, strategyId, type, checked)
        : undefined,
      onResourceBatchChange: onResourceBatchChange
        ? (actionName: string, changes: Array<{resourceId: string; type: "include" | "exclude"; checked: boolean}>) =>
            onResourceBatchChange(moduleName, actionName, changes)
        : undefined
    };
  });
  moduleRendererRegistry.register("preference", new PreferenceModuleRenderer(), (baseContext, extras) => {
    const { moduleData, onResourceChange, onResourceBatchChange } = extras as PreferenceModuleExtras;
    const moduleName = baseContext.moduleStatement.module;
    const preferenceData = moduleData?.[moduleName] as { preferences?: PreferenceResourceItem[] } | undefined;
    return {
      ...baseContext,
      preferences: preferenceData?.preferences,
      onResourceChange: onResourceChange
        ? (actionName: string, preferenceId: string, type: "include" | "exclude", checked: boolean) =>
            onResourceChange(moduleName, actionName, preferenceId, type, checked)
        : undefined,
      onResourceBatchChange: onResourceBatchChange
        ? (actionName: string, changes: Array<{resourceId: string; type: "include" | "exclude"; checked: boolean}>) =>
            onResourceBatchChange(moduleName, actionName, changes)
        : undefined
    };
  });
  moduleRendererRegistry.register("status", new StatusModuleRenderer(), (baseContext, extras) => {
    const { moduleData, onResourceChange, onResourceBatchChange } = extras as StatusModuleExtras;
    const moduleName = baseContext.moduleStatement.module;
    const statusData = moduleData?.[moduleName] as { statusResources?: StatusResourceItem[] } | undefined;
    return {
      ...baseContext,
      statusResources: statusData?.statusResources,
      onResourceChange: onResourceChange
        ? (actionName: string, statusResourceId: string, type: "include" | "exclude", checked: boolean) =>
            onResourceChange(moduleName, actionName, statusResourceId, type, checked)
        : undefined,
      onResourceBatchChange: onResourceBatchChange
        ? (actionName: string, changes: Array<{resourceId: string; type: "include" | "exclude"; checked: boolean}>) =>
            onResourceBatchChange(moduleName, actionName, changes)
        : undefined
    };
  });
  resourceRendererRegistry.register("bucket", new BucketResourceRenderer());
  moduleDataRegistry.register("bucket", BucketModuleDataProvider);
  moduleDataRegistry.register("passport:apikey", ApiKeyModuleDataProvider);
  moduleDataRegistry.register("passport:policy", PolicyModuleDataProvider);
  moduleDataRegistry.register("dashboard", DashboardModuleDataProvider);
  moduleDataRegistry.register("function", FunctionModuleDataProvider);
  moduleDataRegistry.register("passport:identity", IdentityModuleDataProvider);
  moduleDataRegistry.register("webhook", WebhookModuleDataProvider);
  moduleDataRegistry.register("passport:strategy", AuthenticationStrategyModuleDataProvider);
  moduleDataRegistry.register("preference", PreferenceModuleDataProvider);
  moduleDataRegistry.register("status", StatusModuleDataProvider);
}

registerAllRenderers.registered = false;

export function hasCustomModuleRenderer(moduleName: string): boolean {
  return moduleRendererRegistry.hasCustomRenderer(moduleName);
}

export function hasCustomResourceRenderer(module: string): boolean {
  return resourceRendererRegistry.hasCustomRenderer(module);
}

export function clearAllRenderers(): void {
  moduleRendererRegistry.clear();
  resourceRendererRegistry.clear();
}
