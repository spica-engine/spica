/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React from "react";
import type { ModuleRenderer, BaseModuleContext } from "../moduleRenderers";
import type { ApiKey } from "../../../store/api/apiKeyApi";
import type { Policy } from "../../../store/api/policyApi";
import type { OnResourceChange, OnResourceBatchChange } from "../moduleRendererHelpers";
import { EntityPairModuleRenderer, type EntityPairConfig } from "./shared/EntityPairModuleRenderer";

export interface ApiKeyPolicyModuleProps extends BaseModuleContext {
  apiKeys?: ApiKey[];
  policies?: Policy[];
  onResourceChange?: OnResourceChange;
  onResourceBatchChange?: OnResourceBatchChange;
}

export class ApiKeyPolicyModuleRenderer implements ModuleRenderer<ApiKeyPolicyModuleProps> {
  render(props: ApiKeyPolicyModuleProps): React.ReactNode {
    const { apiKeys = [], policies = [], ...rest } = props;

    const config: EntityPairConfig<ApiKey, Policy> = {
      leftEntities: apiKeys,
      rightEntities: policies,
      getLeftId: (apiKey) => apiKey._id ?? "",
      getRightId: (policy) => policy._id,
      getLeftLabel: (apiKey) => apiKey.name,
      getRightLabel: (policy) => policy.name,
      leftPlaceholder: "Select API Key",
      rightPlaceholder: "Select Policy",
      actionNamePrefix: "passport:apikey:policy",
      dataModule: "passport:apikey:policy"
    };

    const renderer = new EntityPairModuleRenderer<ApiKey, Policy>();
    return renderer.render({ ...rest, config });
  }
}
