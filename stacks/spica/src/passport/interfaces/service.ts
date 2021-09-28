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
  source: string | Observable<any>;
  primary: string;
  maps?: Function[];
}

export function isSelectableResource(
  resource: Resource | SelectableResource
): resource is SelectableResource {
  return Object.keys(resource).includes("source");
}
