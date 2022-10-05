import {CdkDragDrop, moveItemInArray, transferArrayItem} from "@angular/cdk/drag-drop";
import {
  Component,
  OnInit,
  Input,
  Output,
  EventEmitter,
  SimpleChanges,
  TemplateRef
} from "@angular/core";
import {MatDialog, MatDialogRef} from "@angular/material/dialog";
import {CategoryService} from "./category.service";

export interface Schema {
  category?: string;
  _id?: string;
}

@Component({
  selector: "category",
  templateUrl: "./category.component.html",
  styleUrls: ["./category.component.scss"]
})
export class CategoryComponent implements OnInit {
  constructor(private dialog: MatDialog, public categoryService: CategoryService) {}

  @Input() schemas: Schema[];
  @Input() categoryStorageKey: string;

  @Input() itemTemplate: TemplateRef<any>;

  categories: {name?: string; order?: number}[] = [];

  @Output() onChangedOrder = new EventEmitter();
  @Output() onClickItem = new EventEmitter();

  categoryModalRef: MatDialogRef<any>;
  categoryModalMode: string;
  newCategory;
  dropListIds: string[];
  categorizedSchemas: {};

  ngOnInit(): void {
    //sort from local storage
    this.categories = this.setCategoryOrderFromStorage([
      ...new Set(this.schemas.filter(schema => schema.category).map(bucket => bucket.category)),
      ...this.categories
    ]);

    this.setSchemaByCategory(this.schemas);
  }

  setSchemaByCategory(data) {
    this.categorizedSchemas = this.categoryService.groupCategoryByKey(data, "category");

    //create a drop list for each category
    this.dropListIds = Object.keys(this.categorizedSchemas).map((schemaKey, index) => {
      if (schemaKey == this.categoryService.EMPTY_CATEGORY_KEYWORD || !schemaKey) {
        return this.categoryService.EMPTY_CATEGORY_DROP_ID;
      }
      return "cdk-drop-list-0" + (index + 1);
    });

    //For those who don't have a category.
    if (!this.categorizedSchemas[this.categoryService.EMPTY_CATEGORY_KEYWORD]) {
      this.categorizedSchemas[this.categoryService.EMPTY_CATEGORY_KEYWORD] = [];
      this.dropListIds.push(this.categoryService.EMPTY_CATEGORY_DROP_ID);
    }
    if (!localStorage.getItem(this.categoryStorageKey + "-category-order")) {
      this.updateCategoryOrdersFromStorage();
    }
  }

  categoryAction() {
    this.categoryModalRef.close(true);
  }

  openCategoryModal(modalTemplate) {
    let editedCategory = this.categoryModalMode == "edit" ? this.newCategory : "";

    this.categoryModalRef = this.dialog.open(modalTemplate, {
      width: "800px",
      maxHeight: "90vh",
      panelClass: "categoryDialog"
    });

    this.categoryModalRef
      .afterClosed()
      .toPromise()
      .then(result => {
        if (result && !this.categories.find(category => category.name == this.newCategory)) {
          switch (this.categoryModalMode) {
            case "add":
              this.categories.push({name: this.newCategory, order: 0});
              this.dropListIds.push("cdk-drop-list-0" + this.dropListIds.length);

              moveItemInArray(this.dropListIds, this.dropListIds.length - 1, 0);

              this.categorizedSchemas[this.newCategory] = [];
              this.changeCategoryOrder(this.categories.length - 1, 0);

              break;
            case "edit":
              const category = this.categories.find(item => item.name == editedCategory);
              category.name = this.newCategory;
              this.updateCategoryOrdersFromStorage();

              const changedItems = [];
              this.categorizedSchemas[editedCategory].forEach(schema => {
                changedItems.push({entry_id: schema._id, changes: {category: this.newCategory}});
              });
              this.onChangedOrder.emit(changedItems);

              this.categorizedSchemas[this.newCategory] = this.categorizedSchemas[editedCategory];
              delete this.categorizedSchemas[editedCategory];

              break;
          }
        }
        this.newCategory = "";
      });
  }

  deleteCategory(deletedCategory: string) {
    const changedItems = [];

    this.categorizedSchemas[deletedCategory].forEach((schema, i) => {
      changedItems.push({
        entry_id: schema._id,
        changes: {category: null, order: schema.order + this.schemas.length + i}
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

    // set changed items for output
    const changedItems = [];
    for (let i = entryCountsOfBefore; i < schemaArray.length; i++) {
      changedItems.push({entry_id: schemaArray[i]._id, changes: {order: i}});
    }
    const draggedItem = changedItems.find(
      item => item.entry_id == event.item.element.nativeElement.id
    );

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

  setCategoryOrderFromStorage(data) {
    const storedCategories =
      localStorage.getItem(this.categoryStorageKey + "-category-order") || "[]";
    let categoryOrders = JSON.parse(storedCategories);

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
}
