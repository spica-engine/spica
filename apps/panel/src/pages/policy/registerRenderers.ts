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
import { useGetAuthenticationStrategiesQuery, type AuthenticationStrategy } from "../../store/api/authenticationStrategyApi";

type ResourceChangeType = "include" | "exclude";

type ResourceChange = {
  resourceId: string;
  type: ResourceChangeType;
  checked: boolean;
};

/**
 * Generic base type for all module extras to eliminate duplication
 */
type BaseModuleExtras = {
  moduleData?: Record<string, unknown>;
  onResourceChange?: (
    module: string,
    actionName: string,
    resourceId: string,
    type: ResourceChangeType,
    checked: boolean
  ) => void;
  onResourceBatchChange?: (
    module: string,
    actionName: string,
    changes: Array<ResourceChange>
  ) => void;
};


function createQueryDataProvider<T>(
  useQuery: () => { data?: T | { data?: T } },
  dataKey: string,
  transform?: (data: T | undefined) => T
): ModuleDataProvider {
  return ({ onData }) => {
    const queryResult = useQuery();
    
    // Handle both direct data and nested {data: {...}} response patterns
    let resolvedData: T | undefined;
    if (queryResult.data && typeof queryResult.data === 'object' && 'data' in queryResult.data) {
      resolvedData = (queryResult.data as { data?: T }).data;
    } else {
      resolvedData = queryResult.data as T | undefined;
    }
    
    const finalData = transform ? transform(resolvedData) : resolvedData;

    useEffect(() => {
      onData({ [dataKey]: finalData ?? [] });
    }, [finalData, onData]);

    return null;
  };
}

/**
 * Creates a static data provider for hardcoded resources
 */
function createStaticDataProvider(dataKey: string, data: unknown): ModuleDataProvider {
  return ({ onData }) => {
    useEffect(() => {
      onData({ [dataKey]: data });
    }, [onData]);

    return null;
  };
}

// Data provider instances
const BucketModuleDataProvider = createQueryDataProvider(
  useGetBucketsQuery,
  "buckets"
);

const ApiKeyModuleDataProvider = createQueryDataProvider(
  useGetApiKeysQuery,
  "apiKeys"
);

const PolicyModuleDataProvider = createQueryDataProvider(
  useGetPoliciesQuery,
  "policies"
);

const DashboardModuleDataProvider = createQueryDataProvider(
  useGetDashboardsQuery,
  "dashboards"
);

const FunctionModuleDataProvider = createQueryDataProvider(
  useGetFunctionsQuery,
  "functions"
);

const IdentityModuleDataProvider = createQueryDataProvider(
  useGetIdentitiesQuery,
  "identities"
);

const WebhookModuleDataProvider = createQueryDataProvider(
  useGetWebhooksQuery,
  "webhooks"
);

const AuthenticationStrategyModuleDataProvider = createQueryDataProvider(
  useGetAuthenticationStrategiesQuery,
  "strategies"
);

const PreferenceModuleDataProvider = createStaticDataProvider("preferences", [
  { title: "Preference", value: "preference" },
  { title: "All Resources", value: "*" }
]);

const StatusModuleDataProvider = createStaticDataProvider("statusResources", [
  { title: "Bucket", value: "bucket" },
  { title: "Identity", value: "identity" },
  { title: "Storage", value: "storage" },
  { title: "Function", value: "function" },
  { title: "API", value: "api" },
  { title: "All Resources", value: "*" }
]);

function createContextTransformer<TData>(dataKey: string) {
  return (baseContext: any, extras: any) => {
    const { moduleData, onResourceChange, onResourceBatchChange } = extras as BaseModuleExtras;
    const moduleName = baseContext.moduleStatement.module;
    const typedData = moduleData?.[moduleName] as { [key: string]: TData } | undefined;
    
    return {
      ...baseContext,
      [dataKey]: typedData?.[dataKey],
      onResourceChange: onResourceChange
        ? (actionName: string, resourceId: string, type: ResourceChangeType, checked: boolean) =>
            onResourceChange(moduleName, actionName, resourceId, type, checked)
        : undefined,
      onResourceBatchChange: onResourceBatchChange
        ? (actionName: string, changes: Array<ResourceChange>) =>
            onResourceBatchChange(moduleName, actionName, changes)
        : undefined
    };
  };
}

type ModuleConfig = {
  name: string;
  renderer: any;
  contextTransformer?: (baseContext: any, extras: any) => any;
  dataProvider?: ModuleDataProvider;
};

type ResourceConfig = {
  name: string;
  renderer: any;
};

const MODULE_CONFIGS: ModuleConfig[] = [
  {
    name: "bucket",
    renderer: new BucketModuleRenderer(),
    contextTransformer: createContextTransformer<BucketType[]>("buckets"),
    dataProvider: BucketModuleDataProvider
  },
  {
    name: "passport:apikey",
    renderer: new ApiKeyModuleRenderer(),
    contextTransformer: createContextTransformer<ApiKey[]>("apiKeys"),
    dataProvider: ApiKeyModuleDataProvider
  },
  {
    name: "passport:policy",
    renderer: new PolicyModuleRenderer(),
    contextTransformer: createContextTransformer<Policy[]>("policies"),
    dataProvider: PolicyModuleDataProvider
  },
  {
    name: "activity",
    renderer: new ActivityModuleRenderer()
  },
  {
    name: "asset",
    renderer: new AssetsModuleRenderer()
  },
  {
    name: "function:logs",
    renderer: new FunctionLogsModuleRenderer()
  },
  {
    name: "webhook:logs",
    renderer: new WebhookLogsModuleRenderer()
  },
  {
    name: "dashboard",
    renderer: new DashboardModuleRenderer(),
    contextTransformer: createContextTransformer<Dashboard[]>("dashboards"),
    dataProvider: DashboardModuleDataProvider
  },
  {
    name: "function",
    renderer: new FunctionModuleRenderer(),
    contextTransformer: createContextTransformer<SpicaFunction[]>("functions"),
    dataProvider: FunctionModuleDataProvider
  },
  {
    name: "passport:identity",
    renderer: new IdentityModuleRenderer(),
    contextTransformer: createContextTransformer<Identity[]>("identities"),
    dataProvider: IdentityModuleDataProvider
  },
  {
    name: "webhook",
    renderer: new WebhookModuleRenderer(),
    contextTransformer: createContextTransformer<Webhook[]>("webhooks"),
    dataProvider: WebhookModuleDataProvider
  },
  {
    name: "passport:strategy",
    renderer: new AuthenticationStrategyModuleRenderer(),
    contextTransformer: createContextTransformer<AuthenticationStrategy[]>("strategies"),
    dataProvider: AuthenticationStrategyModuleDataProvider
  },
  {
    name: "preference",
    renderer: new PreferenceModuleRenderer(),
    contextTransformer: createContextTransformer<PreferenceResourceItem[]>("preferences"),
    dataProvider: PreferenceModuleDataProvider
  },
  {
    name: "status",
    renderer: new StatusModuleRenderer(),
    contextTransformer: createContextTransformer<StatusResourceItem[]>("statusResources"),
    dataProvider: StatusModuleDataProvider
  }
];

const RESOURCE_CONFIGS: ResourceConfig[] = [
  {
    name: "bucket",
    renderer: new BucketResourceRenderer()
  }
];

export function registerAllRenderers(): void {
  if (registerAllRenderers.registered) return;
  registerAllRenderers.registered = true;

  // Register all module renderers from configuration
  MODULE_CONFIGS.forEach(({ name, renderer, contextTransformer, dataProvider }) => {
    if (contextTransformer) {
      moduleRendererRegistry.register(name, renderer, contextTransformer);
    } else {
      moduleRendererRegistry.register(name, renderer);
    }
    
    if (dataProvider) {
      moduleDataRegistry.register(name, dataProvider);
    }
  });

  // Register all resource renderers from configuration
  RESOURCE_CONFIGS.forEach(({ name, renderer }) => {
    resourceRendererRegistry.register(name, renderer);
  });
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
