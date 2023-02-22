import {Component, Input, OnInit} from "@angular/core";
import {Route} from "@spica-client/core/route";
import { BehaviorSubject, Observable } from "rxjs";
import {CategoryService} from "../category/category.service";

@Component({
  selector: "app-expandable-nav",
  templateUrl: "./expandable-nav.component.html",
  styleUrls: ["./expandable-nav.component.scss"]
})
export class ExpandableNavComponent implements OnInit {
  constructor(public categoryService: CategoryService) {}

  @Input() routes$: Observable<Route[]>;
  @Input() currentCategory: BehaviorSubject<any>;
  routes: {
    [propValue: string]: Route[];
  } = {};
  categoryExpandStatus: {[propValue: string]: boolean} = {};

  ngOnInit(): void {
    this.routes$.subscribe(res => {
      this.routes = this.categoryService.groupCategoryByKey(res, "resource_category");
    });
  }
  sortedByCategory(data) {
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

    return data.sort((a, b) => {
      const firstOrder = categoryOrders.find(category => category.name == a.key) || {order: 0};
      const secondOrder = categoryOrders.find(category => category.name == b.key) || {order: 0};
      return firstOrder.order - secondOrder.order;
    });
  }
}
