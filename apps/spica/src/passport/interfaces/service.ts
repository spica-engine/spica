import {Observable} from "rxjs";

export interface Services {
  [module: string]: {
    title: string;
    actions: {
      [action: string]: (SelectableSubResource | SubResource)[];
    };
  };
}

export interface SubResource {
  title: string;
}

export interface SelectableSubResource extends SubResource {
  source: string | Observable<any>;
  primary: string;
  requiredAction: string;
  maps?: Function[];
}

export function isSelectableSubResource(
  resource: SubResource | SelectableSubResource
): resource is SelectableSubResource {
  return Object.keys(resource).includes("source");
}
