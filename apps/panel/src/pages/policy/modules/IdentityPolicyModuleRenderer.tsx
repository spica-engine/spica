/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React from "react";
import type { ModuleRenderer, BaseModuleContext } from "../moduleRenderers";
import type { Identity } from "../../../store/api/identityApi";
import type { Policy } from "../../../store/api/policyApi";
import type { OnResourceChange, OnResourceBatchChange } from "../moduleRendererHelpers";
import { EntityPairModuleRenderer, type EntityPairConfig } from "./shared/EntityPairModuleRenderer";

export interface IdentityPolicyModuleProps extends BaseModuleContext {
  identities?: Identity[];
  policies?: Policy[];
  onResourceChange?: OnResourceChange;
  onResourceBatchChange?: OnResourceBatchChange;
}

export class IdentityPolicyModuleRenderer implements ModuleRenderer<IdentityPolicyModuleProps> {
  render(props: IdentityPolicyModuleProps): React.ReactNode {
    const { identities = [], policies = [], ...rest } = props;

    const config: EntityPairConfig<Identity, Policy> = {
      leftEntities: identities,
      rightEntities: policies,
      getLeftId: (identity) => identity._id ?? "",
      getRightId: (policy) => policy._id,
      getLeftLabel: (identity) => identity.identifier,
      getRightLabel: (policy) => policy.name,
      leftPlaceholder: "Select Identity",
      rightPlaceholder: "Select Policy",
      actionNamePrefix: "passport:identity:policy",
      dataModule: "passport:identity:policy"
    };

    const renderer = new EntityPairModuleRenderer<Identity, Policy>();
    return renderer.render({ ...rest, config });
  }
}
