import {Injectable} from "@angular/core";
import {Route} from "@spica-client/core";

@Injectable({
  providedIn: "root"
})
export class CategoryService {
  public EMPTY_CATEGORY_KEYWORD: string = "$$spicainternal_empty";
  public EMPTY_CATEGORY_NUMBER = Number.MAX_SAFE_INTEGER;
  public EMPTY_CATEGORY_DROP_ID: string = "cdk-drop-list-0" + this.EMPTY_CATEGORY_NUMBER;
  constructor() {}

  categorizeRoutesByKey(routes: Route[], key: string): {[propValue: string]: Route[]} {
    return routes.reduce((previousValue, currentValue) => {
      let schemaCategory = currentValue[key];

      if (!schemaCategory) {
        schemaCategory = this.EMPTY_CATEGORY_KEYWORD;
      }

      previousValue[schemaCategory] = previousValue[schemaCategory] || [];
      previousValue[schemaCategory].push(currentValue);

      return previousValue;
    }, {});
  }
}
