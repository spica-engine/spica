import {CdkDragDrop, moveItemInArray} from "@angular/cdk/drag-drop";
import {STEPPER_GLOBAL_OPTIONS} from "@angular/cdk/stepper";
import {Component, OnDestroy, OnInit} from "@angular/core";
import {MatCheckboxChange} from "@angular/material";
import {ActivatedRoute, Router} from "@angular/router";
import {InputResolver} from "@spica-client/common";
import {deepCopy} from "@spica-client/core";
import {ICONS} from "@spica-client/material";
import {Observable, Subject} from "rxjs";
import {filter, flatMap, map, switchMap, takeUntil, tap} from "rxjs/operators";
import {INPUT_ICONS} from "../../icons";
import {Bucket, emptyBucket} from "../../interfaces/bucket";
import {PredefinedDefault} from "../../interfaces/predefined-default";
import {BucketService} from "../../services/bucket.service";

@Component({
  selector: "bucket-add",
  templateUrl: "./bucket-add.component.html",
  styleUrls: ["./bucket-add.component.scss"],
  providers: [
    {
      provide: STEPPER_GLOBAL_OPTIONS,
      useValue: {displayDefaultIndicatorType: false}
    }
  ]
})
export class BucketAddComponent implements OnInit, OnDestroy {
  readonly inputTypes: string[];
  readonly icons: Array<string> = ICONS;
  readonly bIcons = INPUT_ICONS;
  readonly iconPageSize = 21;

  public isThereVisible = false;
  public visibleIcons: Array<any> = this.icons.slice(0, this.iconPageSize);

  public translatableTypes = ["string", "textarea", "array", "object", "richtext", "storage"];
  public basicPropertyTypes = ["string", "textarea", "boolean", "number"];

  public $buckets: Observable<Bucket[]>;
  public bucket: Bucket = emptyBucket();

  public savingBucketState: Boolean = false;

  public predefinedDefaults: {[key: string]: PredefinedDefault[]};

  public immutableProperties: Array<string> = [];

  public nonPositionedProperties: Array<{[k: string]: any}> = [];
  public propertyPositionMap: {[k: string]: any[]} = {};

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
        filter(params => params.id !== undefined),

        switchMap(params => this.bs.getBucket(params.id)),
        tap(meta => {
          const clone = deepCopy<Bucket>(meta);
          this.bucket = {...this.bucket, ...clone};
          this.immutableProperties = Object.keys(this.bucket.properties);
          this.bucketVisible();
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
    this.nonPositionedProperties = Object.entries(this.bucket.properties)
      .filter(([, prop]) => !prop.options.position)
      .map(([key, value]) => ({key, value}));
    this.propertyPositionMap = Object.entries(this.bucket.properties).reduce(
      (accumulator, [key, value]) => {
        if (accumulator[value.options.position]) {
          accumulator[value.options.position].push({key, value});
        }
        return accumulator;
      },
      {left: [], right: [], bottom: []}
    );
  }

  setPosition(event: CdkDragDrop<any[]>, position?: string) {
    event.previousContainer.data[event.previousIndex].value.options.position = position;
    this.updatePositionProperties();
  }

  addField(propertyKey: string) {
    if (propertyKey && !this.bucket.properties[propertyKey]) {
      this.bucket.properties[propertyKey.toLowerCase()] = {
        type: "string",
        title: propertyKey,
        description: `Description of '${propertyKey}'`,
        options: {
          position: undefined
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
    if (this.bucket.required) {
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

  bucketVisible() {
    this.isThereVisible = false;
    for (const property in this.bucket.properties) {
      if (this.bucket.properties[property].options.visible === true) {
        this.isThereVisible = true;
      }
    }
  }
}
