/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

export interface ResourceItem {
  id: string;
  label: string;
}

export interface CatalogAction {
  name: string;
  acceptsResource: boolean;
  resources: ResourceItem[];
}

export interface CatalogModule {
  module: string;
  label: string;
  actions: CatalogAction[];
}

export interface PolicyCatalog {
  modules: CatalogModule[];
}
