import {Component, OnInit, Input, Output, EventEmitter, SimpleChanges} from "@angular/core";
import {MatDialog, MatDialogRef} from "@angular/material/dialog";

@Component({
  selector: "categorizing",
  templateUrl: "./categorizing.component.html",
  styleUrls: ["./categorizing.component.scss"]
})
export class CategorizingComponent implements OnInit {
  constructor(private dialog: MatDialog) {}

  @Input() categories: string[];
  @Input() schema: any;
  @Output() onSelectCategory = new EventEmitter();
  categoryModalRef: MatDialogRef<any>;
  existCategory: string = "";
  newCategory: string = "";

  ngOnInit(): void {
    this.existCategory = this.schema?.category;
  }
  addCategory() {
    this.categoryModalRef.close(true);
  }
  selectCategory(event) {
    this.onSelectCategory.emit(event);
  }
  discardCategory() {
    setTimeout(() => {
      this.onSelectCategory.emit("");
    }, 200);
  }
  createNewCategory(modalTemplate) {
    this.categoryModalRef = this.dialog.open(modalTemplate, {
      width: "800px",
      maxHeight: "90vh"
    });

    this.categoryModalRef
      .afterClosed()
      .toPromise()
      .then(async result => {
        if (result && !this.categories.includes(this.newCategory)) {
            this.categories.push(this.newCategory);
            this.schema.category = this.newCategory;
        } else this.schema.category = this.existCategory;
        
        this.newCategory="";
        this.onSelectCategory.emit(this.schema.category)
      });
  }
  ngOnChanges(changes: SimpleChanges): void {
    if (changes.schema) {
      this.existCategory = this.schema.category;
      this.newCategory=""
    }
  }
}
