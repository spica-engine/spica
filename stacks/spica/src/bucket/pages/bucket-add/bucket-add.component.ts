import {animate, style, transition, trigger} from "@angular/animations";
import {CdkDragDrop, moveItemInArray} from "@angular/cdk/drag-drop";
import {Component, OnDestroy, OnInit} from "@angular/core";
import {MatCheckboxChange} from "@angular/material";
import {ActivatedRoute, Router} from "@angular/router";
import {InputResolver} from "@spica-client/common";
import {deepCopy} from "@spica-client/core";
import {ICONS} from "@spica-client/material";
import {Subject} from "rxjs";
import {filter, flatMap, map, switchMap, takeUntil, tap} from "rxjs/operators";
import {INPUT_ICONS} from "../../icons";
import {Bucket, emptyBucket} from "../../interfaces/bucket";
import {PredefinedDefault} from "../../interfaces/predefined-default";
import {BucketService} from "../../services/bucket.service";

@Component({
  selector: "bucket-add",
  templateUrl: "./bucket-add.component.html",
  styleUrls: ["./bucket-add.component.scss"],
  animations: [
    trigger("smooth", [
      transition(":enter", [style({opacity: 0}), animate("0.3s ease-out", style({opacity: 1}))]),
      transition(":leave", [style({opacity: 1}), animate("0.3s ease-in", style({opacity: 0}))])
    ])
  ]
})
export class BucketAddComponent implements OnInit, OnDestroy {
  readonly inputTypes: string[];
  readonly icons: Array<string> = ICONS;
  readonly bIcons = INPUT_ICONS;
  readonly iconPageSize = 21;

  isThereVisible = true;
  visibleIcons: Array<any> = this.icons.slice(0, this.iconPageSize);

  translatableTypes = ["string", "textarea", "array", "object", "richtext", "storage"];
  basicPropertyTypes = ["string", "textarea", "boolean", "number"];

  bucket: Bucket;

  savingBucketState: boolean = false;

  predefinedDefaults: {[key: string]: PredefinedDefault[]};

  immutableProperties: Array<string> = [];

  propertyPositionMap: {[k: string]: any[]} = {};

  private onDestroy: Subject<void> = new Subject<void>();

  constructor(
    _inputResolver: InputResolver,
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private bs: BucketService
  ) {
    this.inputTypes = _inputResolver.entries();
  }

  ngOnInit(): void {
    this.activatedRoute.params
      .pipe(
        flatMap(params =>
          this.bs.getPredefinedDefaults().pipe(
            map(predefs => {
              this.predefinedDefaults = predefs.reduce((accumulator, item) => {
                accumulator[item.type] = accumulator[item.type] || [];
                accumulator[item.type].push(item);
                return accumulator;
              }, {});
              return params;
            })
          )
        ),
        tap(params => {
          if (!params.id) {
            this.bucket = emptyBucket();
            this.updatePositionProperties();
          }
        }),
        filter(params => params.id),
        switchMap(params => this.bs.getBucket(params.id)),
        tap(scheme => {
          this.bucket = deepCopy<Bucket>(scheme);
          this.immutableProperties = Object.keys(this.bucket.properties);
        }),
        takeUntil(this.onDestroy)
      )
      .subscribe(() => this.updatePositionProperties());
  }

  cardDrop(event: CdkDragDrop<Bucket[]>) {
    const properties = Object.entries(this.bucket.properties);

    moveItemInArray(properties, event.previousIndex, event.currentIndex);

    this.bucket.properties = properties.reduce((accumulator, [key, value], index) => {
      accumulator[key] = value;
      return accumulator;
    }, {});
  }

  updatePositionProperties() {
    this.propertyPositionMap = Object.entries(this.bucket.properties).reduce(
      (accumulator, [key, value]) => {
        value.options.position = value.options.position || "bottom";
        accumulator[value.options.position].push({key, value});

        return accumulator;
      },
      {left: [], right: [], bottom: []}
    );
    this.isThereVisible = Object.values(this.bucket.properties).some(
      prop => prop.options && prop.options.visible
    );
  }

  setPosition(event: CdkDragDrop<any[]>, position?: string) {
    event.previousContainer.data[event.previousIndex].value.options.position = position;
    this.updatePositionProperties();
  }

  addProperty(propertyKey: string) {
    if (propertyKey && !this.bucket.properties[propertyKey]) {
      const propertyName = propertyKey.toLowerCase();
      this.bucket.properties[propertyName] = {
        type: this.inputTypes.indexOf(propertyName) > -1 ? propertyName : "string",
        title: propertyKey,
        description: `Description of ${propertyKey}`,
        options: {
          position: "bottom"
        }
      };
      this.updatePositionProperties();
    }
  }

  setDefault(event: MatCheckboxChange, propertyKey) {
    if (event.checked) {
      this.bucket.properties[propertyKey].default = undefined;
    } else {
      delete this.bucket.properties[propertyKey].default;
    }
  }

  deleteProperty(propertyKey: string) {
    delete this.bucket.properties[propertyKey];
    if (this.bucket.primary === propertyKey) {
      this.bucket.primary = undefined;
    }

    if (this.bucket.required && this.bucket.required.includes(propertyKey)) {
      this.bucket.required.splice(this.bucket.required.indexOf(propertyKey), 1);
    }

    this.bucket.properties = {...this.bucket.properties};
    this.updatePositionProperties();
  }

  saveBucket(): void {
    this.savingBucketState = true;
    this.bs
      .replaceOne(this.bucket)
      .toPromise()
      .then(data => {
        this.savingBucketState = false;
        this.router.navigate(["buckets/" + data._id]);
      });
  }

  ngOnDestroy() {
    this.onDestroy.next();
  }
}
