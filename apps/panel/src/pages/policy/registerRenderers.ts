/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import { useEffect } from "react";
import { moduleDataRegistry, moduleRendererRegistry, type ModuleDataProvider } from "./moduleRenderers";
import { resourceRendererRegistry } from "./resourceRenderers";

import { BucketModuleRenderer } from "./modules/BucketModuleRenderer";

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


const BucketModuleDataProvider: ModuleDataProvider = ({ onData }) => {
  const { data: buckets = [] } = useGetBucketsQuery();

  useEffect(() => {
    onData({ buckets });
  }, [buckets, onData]);

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
  resourceRendererRegistry.register("bucket", new BucketResourceRenderer());
  moduleDataRegistry.register("bucket", BucketModuleDataProvider);
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
