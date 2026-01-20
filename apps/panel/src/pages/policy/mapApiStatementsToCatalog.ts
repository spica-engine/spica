/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import type { PolicyCatalog, CatalogModule, CatalogAction } from "./policyCatalog";

export interface ApiStatementModule {
  title: string;
  actions: {
    [actionName: string]: ApiResource[];
  };
}

export interface ApiResource {
  title: string;
  source?: string;
  primary?: string;
  requiredAction?: string;
}

export interface ApiStatementsResponse {
  [module: string]: ApiStatementModule;
}

export function mapApiStatementsToCatalog(apiData: ApiStatementsResponse): PolicyCatalog {
  if (!apiData || typeof apiData !== "object") {
    return { modules: [] };
  }

  const modules: CatalogModule[] = [];

  for (const [moduleName, moduleData] of Object.entries(apiData)) {
    if (!moduleData || !moduleData.actions) continue;

    const actions: CatalogAction[] = [];

    for (const [actionName, resourcesArray] of Object.entries(moduleData.actions)) {
      const acceptsResource = Array.isArray(resourcesArray) && resourcesArray.length > 0;

      actions.push({
        name: actionName,
        acceptsResource,
        resources: [],
      });
    }

    modules.push({
      module: moduleName,
      label: moduleData.title || moduleName,
      actions,
    });
  }

  modules.sort((a, b) => a.label.localeCompare(b.label));

  return { modules };
}

export function getResourcesForAction(
  apiData: ApiStatementsResponse,
  module: string,
  action: string
): ApiResource[] {
  const moduleData = apiData[module];
  if (!moduleData?.actions?.[action]) return [];
  
  return moduleData.actions[action] || [];
}

export function actionAcceptsResources(
  apiData: ApiStatementsResponse,
  module: string,
  action: string
): boolean {
  const resources = getResourcesForAction(apiData, module, action);
  return resources.length > 0;
}
