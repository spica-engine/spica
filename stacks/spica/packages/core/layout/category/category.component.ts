import {CdkDragDrop, moveItemInArray, transferArrayItem} from "@angular/cdk/drag-drop";
import {ComponentType} from "@angular/cdk/portal";
import {Component, OnInit, Input, Output, EventEmitter, SimpleChanges} from "@angular/core";
import {MatDialog, MatDialogRef} from "@angular/material/dialog";
import {Route} from "@spica-client/core/route";
import {Subscription} from "rxjs";
import {CategoryService} from "./category.service";

export interface Schema {
  resource_category?: string;
  _id?: string;
}

@Component({
  selector: "category",
  templateUrl: "./category.component.html",
  styleUrls: ["./category.component.scss"]
})
export class CategoryComponent implements OnInit {
  constructor(private dialog: MatDialog, public categoryService: CategoryService) {}

  @Input() categoryStorageKey: string;
  @Input() routes$;
  @Input() currentCategory;
  @Input() moreTemplate: ComponentType<any>;
  @Output() onChangedOrder = new EventEmitter();
  @Output() onClickItem = new EventEmitter();

  routes: Route[] = [];
  categories: {name?: string; order?: number}[] = [];
  categoryExpandStatus: {[propValue: string]: boolean} = {};
  categoryModalRef: MatDialogRef<any>;
  addCategoryModalRef: MatDialogRef<any>;
  adCategoryItemName: string;
  categoryModalMode: string;
  newCategory;
  dropListIds: string[];
  categorizedSchemas: {};
  subs: Subscription;

  ngOnInit(): void {
    this.subs = this.routes$.pipe().subscribe(routes => {
      this.routes = routes;

      //sort from local storage
      this.categories = this.setCategoryOrderFromStorage([
        ...new Set([
          ...this.routes
            .filter(route => route.resource_category)
            .map(bucket => bucket.resource_category)
        ])
      ]);
      this.setSchemaByCategory(this.routes);
    });
  }
  ngOnDestroy(): void {
    //Called once, before the instance is destroyed.
    //Add 'implements OnDestroy' to the class.
    this.subs.unsubscribe();
  }

  setSchemaByCategory(data) {
    this.categorizedSchemas = this.categoryService.groupCategoryByKey(data, "resource_category");

    //create a drop list for each category
    this.dropListIds = Object.keys(this.categorizedSchemas)
      .filter(key => key && key != this.categoryService.EMPTY_CATEGORY_KEYWORD)
      .map((_, index) => {
        return "cdk-drop-list-0" + (index + 1);
      });

    //For those who don't have a category.
    if (!this.categorizedSchemas[this.categoryService.EMPTY_CATEGORY_KEYWORD]) {
      this.categorizedSchemas[this.categoryService.EMPTY_CATEGORY_KEYWORD] = [];
    }
    this.dropListIds.push(this.categoryService.EMPTY_CATEGORY_DROP_ID);
    if (!localStorage.getItem(this.categoryStorageKey + "-category-order")) {
      this.updateCategoryOrdersFromStorage();
    }
    // console.log("this.categorizedSchemas :", this.categorizedSchemas)
    // console.log("this.dropListIds :", this.dropListIds)
  }

  categoryAction() {
    this.categoryModalRef.close(true);
  }
  onAddToCategory() {
    this.addCategoryModalRef.close(true);
  }

  openAddToCategory(modalTemplate, routeId) {
    this.addCategoryModalRef = this.dialog.open(modalTemplate, {
      minWidth: "380px",
      maxHeight: "90vh",
      panelClass: "categoryDialog"
    });
    this.addCategoryModalRef
      .afterClosed()
      .toPromise()
      .then(result => {
        if (!result) return;

        const existCategory = this.categories.find(category => category.name == this.newCategory);
        if (!existCategory) {
          this.categories.push({name: this.newCategory, order: this.categories.length + 1});
          this.updateCategoryOrdersFromStorage();
        }
        this.onChangedOrder.emit([
          {
            id: routeId,
            changes: {category: this.newCategory}
          }
        ]);
        this.newCategory = "";
      });
  }

  openCategoryModal(modalTemplate, oldName: string) {
    this.categoryModalRef = this.dialog.open(modalTemplate, {
      minWidth: "380px",
      maxHeight: "90vh",
      panelClass: "categoryDialog"
    });

    this.categoryModalRef
      .afterClosed()
      .toPromise()
      .then(result => {
        if (result && !this.categories.find(category => category.name == this.newCategory)) {
          const category = this.categories.find(item => item.name == oldName);
          category.name = this.newCategory;

          const changedItems = [];
          this.categorizedSchemas[oldName].forEach(schema => {
            changedItems.push({id: schema.id, changes: {category: this.newCategory}});
          });

          this.updateCategoryOrdersFromStorage();
          this.onChangedOrder.emit(changedItems);

          this.categorizedSchemas[this.newCategory] = this.categorizedSchemas[oldName];
          delete this.categorizedSchemas[oldName];
        }
        this.newCategory = "";
      });
  }

  deleteCategory(deletedCategory: string) {
    const changedItems = [];
    this.categorizedSchemas[deletedCategory].forEach((route: Route, i) => {
      changedItems.push({
        id: route.id,
        changes: {
          category: null,
          order:
            this.routes.length -
            this.categorizedSchemas[this.categoryService.EMPTY_CATEGORY_DROP_ID] +
            i
        }
      });
    });

    //discard from category and add to the empty category
    this.categorizedSchemas[this.categoryService.EMPTY_CATEGORY_KEYWORD] = [
      ...this.categorizedSchemas[this.categoryService.EMPTY_CATEGORY_KEYWORD],
      ...this.categorizedSchemas[deletedCategory]
    ];

    delete this.categorizedSchemas[deletedCategory];

    this.categories = this.categories.filter(category => category.name != deletedCategory);

    this.updateCategoryOrdersFromStorage();
    this.onChangedOrder.emit(changedItems);
  }
  drop(event: CdkDragDrop<any>) {
    const getIndexnumber = (str: string) => Number(str.split("-0")[1]) - 1;
    const previousContainerIndex = getIndexnumber(event.previousContainer.id);
    const currentContainerIndex = getIndexnumber(event.container.id);

    let smallestCategoryIndex =
      currentContainerIndex < previousContainerIndex
        ? currentContainerIndex
        : previousContainerIndex;

    let entryCountsOfBefore = 0;
    let schemaArray = [];

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
      if (index < smallestCategoryIndex) {
        entryCountsOfBefore += this.categorizedSchemas[category.name].length;
      }
      schemaArray = [...schemaArray, ...this.categorizedSchemas[category.name]];
    });

    if (this.categorizedSchemas[this.categoryService.EMPTY_CATEGORY_KEYWORD]) {
      schemaArray = [
        ...schemaArray,
        ...this.categorizedSchemas[this.categoryService.EMPTY_CATEGORY_KEYWORD]
      ];
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

    schemaArray = schemaArray.filter(item => item.draggable);

    // set changed items for output
    const changedItems = [];
    for (let i = entryCountsOfBefore; i < schemaArray.length; i++) {
      changedItems.push({id: schemaArray[i].id, changes: {order: i}});
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
    this.updateCategoryOrdersFromStorage();
  }

  dropColumn(event: CdkDragDrop<any>) {
    this.changeCategoryOrder(event.previousIndex, event.currentIndex);
  }

  updateCategoryOrdersFromStorage() {
    localStorage.setItem(
      this.categoryStorageKey + "-category-order",
      JSON.stringify(
        this.categories.map((item, index) => {
          return {
            name: item.name,
            order: index
          };
        })
      )
    );
  }

  getStoredCategories() {
    const storedCategories =
      localStorage.getItem(this.categoryStorageKey + "-category-order") || "[]";
    return JSON.parse(storedCategories);
  }

  setCategoryOrderFromStorage(data) {
    const categoryOrders = this.getStoredCategories();
    return data
      .map(element => {
        const findedElement = categoryOrders.find(item => item.name == element) || {order: 0};
        return {
          name: element,
          order: findedElement.order
        };
      })
      .sort((item1, item2) => item1.order - item2.order);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes.schemas &&
      !changes.schemas.firstChange &&
      changes.schemas.previousValue.length != changes.schemas.currentValue.length
    ) {
      this.setSchemaByCategory(changes.schemas.currentValue);
    }
  }
  getCategoryByName(name: string = "") {
    return this.categories.filter(category =>
      category.name.toLowerCase().includes(name.toLowerCase())
    );
  }
}
