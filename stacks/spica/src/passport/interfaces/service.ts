import {Observable} from "rxjs";

export interface Services {
  [module: string]: {
    [action: string]: (SelectableResource | Resource)[];
  };
}

export interface Resource {
  title: string;
}

export interface SelectableResource extends Resource {
  // Reduce these two variable to one
  url: string;
  values: Observable<any[]>;
  primary: string;
}

export function isSelectableSubResource(
  resource: Resource | SelectableResource
): resource is SelectableResource {
  return Object.keys(resource).includes("values") || Object.keys(resource).includes("url");
}
