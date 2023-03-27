import {Injectable} from "@angular/core";
import {Route} from "@spica-client/core";
import {CategorizedRoutes, CategoryOrder} from "./interface";

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

  saveCategoryOrders(categoryStorageKey: string, categories: CategoryOrder[]) {
    localStorage.setItem(
      categoryStorageKey + "-category-order",
      JSON.stringify(
        categories.map((item, index) => {
          return {
            name: item.name,
            order: index
          };
        })
      )
    );
  }

  readCategoryOrders(categoryStorageKey: string): CategoryOrder[] {
    const storedCategories = localStorage.getItem(categoryStorageKey + "-category-order") || "[]";
    return JSON.parse(storedCategories);
  }
}
