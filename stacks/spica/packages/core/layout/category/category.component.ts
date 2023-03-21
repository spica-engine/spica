import {CdkDragDrop, moveItemInArray, transferArrayItem} from "@angular/cdk/drag-drop";
import {ComponentType} from "@angular/cdk/portal";
import {
  Component,
  OnInit,
  Input,
  Output,
  EventEmitter,
  SimpleChanges,
  OnDestroy
} from "@angular/core";
import {MatDialog, MatDialogRef} from "@angular/material/dialog";
import {Route} from "@spica-client/core/route";
import {BehaviorSubject, Observable, Subscription} from "rxjs";
import {CategoryService} from "./category.service";
import {CategorizedRoutes, CategoryOrder} from "./interface";

@Component({
  selector: "category",
  templateUrl: "./category.component.html",
  styleUrls: ["./category.component.scss"]
})
export class CategoryComponent implements OnInit, OnDestroy {
  constructor(private dialog: MatDialog, public categoryService: CategoryService) {}

  @Input() categoryStorageKey: string;
  @Input() routes$: Observable<Route[]>;
  @Input() currentCategory: BehaviorSubject<any>;
  @Input() moreTemplate: ComponentType<any>;
  @Output() onChangedOrder = new EventEmitter();
  @Output() onClickItem = new EventEmitter();

  routes: Route[] = [];

  categories: CategoryOrder[] = [];
  categoryExpandStatus: {[propValue: string]: boolean} = {};

  editCategoryModalRef: MatDialogRef<any>;

  addToCategoryModalRef: MatDialogRef<any>;
  addToCategoryItemName: string;

  newCategory;

  dropListIds: string[];

  categorizedRoutes: CategorizedRoutes;
  subs: Subscription;

  ngOnInit(): void {
    this.subs = this.routes$.pipe().subscribe(routes => {
      this.routes = routes;

      const categoryNames = new Set(
        this.routes.filter(route => route.resource_category).map(route => route.resource_category)
      );

      this.categories = this.fillCategoryOrders(Array.from(categoryNames));
      this.initCategories(this.routes);
    });
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  initCategories(routes: Route[], field = "resource_category") {
    this.categorizedRoutes = this.categoryService.categorizeRoutesByKey(routes, field);

    this.dropListIds = Object.keys(this.categorizedRoutes)
      .filter(key => key && key != this.categoryService.EMPTY_CATEGORY_KEYWORD)
      .map((_, index) => {
        return "cdk-drop-list-0" + (index + 1);
      });

    if (!this.categorizedRoutes[this.categoryService.EMPTY_CATEGORY_KEYWORD]) {
      this.categorizedRoutes[this.categoryService.EMPTY_CATEGORY_KEYWORD] = [];
    }
    this.dropListIds.push(this.categoryService.EMPTY_CATEGORY_DROP_ID);

    if (!this.categoryService.readCategoryOrders(this.categoryStorageKey).length) {
      this.categoryService.saveCategoryOrders(this.categoryStorageKey, this.categories);
    }
  }

  openAddToCategory(modalTemplate, routeId: string) {
    const afterClosed = result => {
      if (!result) {
        return;
      }

      const existCategory = this.categories.find(category => category.name == this.newCategory);
      if (!existCategory) {
        this.categories.push({name: this.newCategory, order: this.categories.length});
        this.categoryService.saveCategoryOrders(this.categoryStorageKey, this.categories);
      }

      this.onChangedOrder.emit([
        {
          id: routeId,
          changes: {category: this.newCategory}
        }
      ]);
      this.newCategory = "";
    };

    this.addToCategoryModalRef = this.openModal(modalTemplate, afterClosed);
  }

  openEditCategoryModal(modalTemplate, oldName: string) {
    const afterClosed = result => {
      if (!result) {
        return;
      }

      const category = this.categories.find(item => item.name == oldName);
      category.name = this.newCategory;

      const changedItems = [];
      this.categorizedRoutes[oldName].forEach(route => {
        changedItems.push({id: route.id, changes: {category: this.newCategory}});
      });

      this.categoryService.saveCategoryOrders(this.categoryStorageKey, this.categories);
      this.onChangedOrder.emit(changedItems);

      this.categorizedRoutes[this.newCategory] = this.categorizedRoutes[oldName];
      delete this.categorizedRoutes[oldName];

      this.newCategory = "";
    };

    this.editCategoryModalRef = this.openModal(modalTemplate, afterClosed);
  }

  isCategoryNameUnique(name: string) {
    return name && !this.categories.find(category => category.name == name);
  }

  openModal(modalTemplate, afterClosed: (response) => void) {
    const ref = this.dialog.open(modalTemplate, {
      minWidth: "380px",
      maxHeight: "90vh",
      panelClass: "categoryDialog"
    });

    ref
      .afterClosed()
      .toPromise()
      .then(afterClosed);

    return ref;
  }

  onCategorySelect(name: string, dialogRef: MatDialogRef<any>) {
    this.newCategory = name;
    dialogRef.close(true);
  }

  deleteCategory(name: string) {
    const changedItems = [];
    this.categorizedRoutes[name].forEach((route, i) => {
      changedItems.push({
        id: route.id,
        changes: {
          category: null,
          order: this.routes.length + i
        }
      });
    });

    //discard from category and add to the empty category
    this.categorizedRoutes[this.categoryService.EMPTY_CATEGORY_KEYWORD] = [
      ...this.categorizedRoutes[this.categoryService.EMPTY_CATEGORY_KEYWORD],
      ...this.categorizedRoutes[name]
    ];

    delete this.categorizedRoutes[name];

    this.categories = this.categories.filter(category => category.name != name);

    this.categoryService.saveCategoryOrders(this.categoryStorageKey, this.categories);
    this.onChangedOrder.emit(changedItems);
  }

  drop(event: CdkDragDrop<any>) {
    const getIndexnumber = (str: string) => Number(str.split("-0")[1]) - 1;
    const previousContainerIndex = getIndexnumber(event.previousContainer.id);
    const currentContainerIndex = getIndexnumber(event.container.id);

    let lowestCategoryIndex =
      currentContainerIndex < previousContainerIndex
        ? currentContainerIndex
        : previousContainerIndex;

    let entryCountsOfBefore = 0;
    let routes = [];

    if (event.previousContainer === event.container) {
      if (event.currentIndex == event.previousIndex) return;
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
    }

    this.categories.forEach((category, index) => {
      if (index < lowestCategoryIndex) {
        entryCountsOfBefore += this.categorizedRoutes[category.name].length;
      }
      routes = [...routes, ...this.categorizedRoutes[category.name]];
    });

    if (this.categorizedRoutes[this.categoryService.EMPTY_CATEGORY_KEYWORD]) {
      routes = [...routes, ...this.categorizedRoutes[this.categoryService.EMPTY_CATEGORY_KEYWORD]];
    }

    //calculating entry counts of before dropped element
    if (previousContainerIndex < currentContainerIndex) {
      entryCountsOfBefore += event.previousIndex;
    } else if (previousContainerIndex > currentContainerIndex) {
      entryCountsOfBefore += event.currentIndex;
    } else {
      entryCountsOfBefore +=
        event.previousIndex < event.currentIndex ? event.previousIndex : event.currentIndex;
    }

    routes = routes.filter(item => item.draggable);

    // set changed items for output
    const changedItems = [];
    for (let i = entryCountsOfBefore; i < routes.length; i++) {
      changedItems.push({id: routes[i].id, changes: {order: i}});
    }
    const draggedItem = changedItems.find(item => item.id == event.item.element.nativeElement.id);

    if (draggedItem && this.categories[currentContainerIndex]) {
      draggedItem.changes["category"] = this.categories[currentContainerIndex].name;
    }

    if (this.categories[previousContainerIndex] && !this.categories[currentContainerIndex]) {
      draggedItem.changes["category"] = null;
    }

    this.onChangedOrder.emit(changedItems);
  }

  changeCategoryOrder(previousIndex, currentIndex) {
    moveItemInArray(this.categories, previousIndex, currentIndex);
    this.categoryService.saveCategoryOrders(this.categoryStorageKey, this.categories);
  }

  fillCategoryOrders(data: string[]) {
    const categoryOrders = this.categoryService.readCategoryOrders(this.categoryStorageKey);
    return data
      .map(name => {
        const {order} = categoryOrders.find(item => item.name == name) || {order: 0};
        return {
          name,
          order
        };
      })
      .sort((item1, item2) => item1.order - item2.order);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes.routes &&
      !changes.routes.firstChange &&
      changes.routes.previousValue.length != changes.routes.currentValue.length
    ) {
      this.initCategories(changes.routes.currentValue);
    }
  }
  getCategoryByName(name: string = "") {
    return this.categories.filter(category =>
      category.name.toLowerCase().includes(name.toLowerCase())
    );
  }
}
