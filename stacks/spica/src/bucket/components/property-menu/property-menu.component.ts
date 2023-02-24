import {moveItemInArray} from "@angular/cdk/drag-drop";
import {Component, EventEmitter, Input, OnInit, Output} from "@angular/core";
import {MatDialog} from "@angular/material/dialog";
import {MatSnackBar} from "@angular/material/snack-bar";
import {Sort} from "@angular/material/sort";
import {Bucket} from "@spica-client/bucket/interfaces/bucket";
import {AddFieldModalComponent} from "@spica-client/bucket/pages/add-field-modal/add-field-modal.component";
import {BucketService} from "@spica-client/bucket/services/bucket.service";
import {SnackbarError} from "@spica-client/core/layout/snackbar/interface";
import {SnackbarComponent} from "@spica-client/core/layout/snackbar/snackbar.component";

@Component({
  selector: "app-property-menu",
  templateUrl: "./property-menu.component.html"
})
export class PropertyMenuComponent implements OnInit {
  @Input() schema: Bucket;
  @Input() displayedProperties: string[];
  @Input() property: any;
  @Output() handleSortChange = new EventEmitter<Sort>();

  constructor(
    private _snackBar: MatSnackBar,
    private bs: BucketService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {}

  deleteProperty(propertyKey: string) {
    if (this.schema.primary === propertyKey) {
      this._snackBar.openFromComponent(SnackbarComponent, {
        data: {
          message:
            "In order to delete the primary field, you must first select another field as primary"
        } as SnackbarError,
        duration: 5000
      });
      return;
    }

    delete this.schema.properties[propertyKey];
    if (this.schema.required && this.schema.required.includes(propertyKey)) {
      this.schema.required.splice(this.schema.required.indexOf(propertyKey), 1);
    }
    this.saveSchema();
  }
  async editNewProperty(propertyKey: string = null) {
    this.dialog.open(AddFieldModalComponent, {
      width: "800px",
      maxHeight: "90vh",
      data: {
        parentSchema: this.schema,
        propertyKey: propertyKey
      }
    });
  }

  saveSchema() {
    this.bs.replaceOne(this.schema).toPromise();
  }

  moveField(field: string, value: 1 | -1) {
    const keys = Object.keys(this.schema.properties);
    const properties = Object.entries(this.schema.properties);

    moveItemInArray(properties, keys.indexOf(field), keys.indexOf(field) + value);
    this.schema.properties = properties.reduce((accumulator, [key, value]) => {
      accumulator[key] = value;
      return accumulator;
    }, {});

    const cachedDisplayedProperties = JSON.parse(
      localStorage.getItem(`${this.schema._id}-displayedProperties`)
    );

    const fromIndex = cachedDisplayedProperties.indexOf(field); // 👉️ 0
    const element = cachedDisplayedProperties.splice(fromIndex, 1)[0];

    cachedDisplayedProperties.splice(fromIndex + value, 0, element);
    localStorage.setItem(
      `${this.schema._id}-displayedProperties`,
      JSON.stringify(cachedDisplayedProperties)
    );

    this.saveSchema();
  }
}
