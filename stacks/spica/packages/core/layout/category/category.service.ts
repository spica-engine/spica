import {Injectable} from "@angular/core";
import {Route} from "@spica-client/core";
import {CategorizedRoutes} from "./interface"

@Injectable({
  providedIn: "root"
})
export class CategoryService {
  public EMPTY_CATEGORY_KEYWORD: string = "$$spicainternal_empty";
  public EMPTY_CATEGORY_NUMBER = Number.MAX_SAFE_INTEGER;
  public EMPTY_CATEGORY_DROP_ID: string = "cdk-drop-list-0" + this.EMPTY_CATEGORY_NUMBER;
  constructor() {}

  categorizeRoutesByKey(routes: Route[], key: string): CategorizedRoutes {
    return routes.reduce((previousValue, currentValue) => {
      let category = currentValue[key];

      if (!category) {
        category = this.EMPTY_CATEGORY_KEYWORD;
      }

      previousValue[category] = previousValue[category] || [];
      previousValue[category].push(currentValue);

      return previousValue;
    }, {});
  }
}
