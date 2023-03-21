import {Component, Input, OnInit} from "@angular/core";
import {Route} from "@spica-client/core/route";
import {BehaviorSubject, Observable} from "rxjs";
import {CategoryService} from "../category/category.service";
import {CategorizedRoutes} from "../category/interface";

@Component({
  selector: "expandable-nav",
  templateUrl: "./expandable-nav.component.html",
  styleUrls: ["./expandable-nav.component.scss"]
})
export class ExpandableNavComponent implements OnInit {
  constructor(public categoryService: CategoryService) {}

  @Input() routes$: Observable<Route[]>;
  @Input() currentCategory: BehaviorSubject<any>;
  routes: CategorizedRoutes = {};
  categoryExpandStatus: {[propValue: string]: boolean} = {};

  ngOnInit(): void {
    this.routes$.subscribe(res => {
      this.routes = this.categoryService.categorizeRoutesByKey(res, "resource_category");
    });
  }

  sortByCategory(categoryAndRoutes: {key: string; value: Route[]}[]) {
    const storedCategories =
      localStorage.getItem(this.currentCategory.value.category + "-category-order") || "[]";
    let categoryOrders = JSON.parse(storedCategories);

    let emptyCategory = categoryOrders.find(
      item => item.name == this.categoryService.EMPTY_CATEGORY_KEYWORD
    );
    if (!emptyCategory)
      categoryOrders.push({
        name: this.categoryService.EMPTY_CATEGORY_KEYWORD,
        order: this.categoryService.EMPTY_CATEGORY_NUMBER
      });
    else emptyCategory.order = this.categoryService.EMPTY_CATEGORY_NUMBER;

    return categoryAndRoutes.sort((first, second) => {
      const def = {order: 0};

      const firstOrder = categoryOrders.find(category => category.name == first.key) || def;
      const secondOrder = categoryOrders.find(category => category.name == second.key) || def;

      return firstOrder.order - secondOrder.order;
    });
  }
}
