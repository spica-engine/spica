import {animate, style, transition, trigger} from "@angular/animations";
import {CdkDragDrop, moveItemInArray} from "@angular/cdk/drag-drop";
import {Component, HostListener, OnDestroy, OnInit} from "@angular/core";
import {MatCheckboxChange} from "@angular/material/checkbox";
import {ActivatedRoute, Router} from "@angular/router";
import {InputResolver} from "@spica-client/common";
import {deepCopy} from "@spica-client/core";
import {ICONS, SavingState} from "@spica-client/material";
import {Subject, Observable, merge, of} from "rxjs";
import {
  filter,
  flatMap,
  map,
  switchMap,
  takeUntil,
  tap,
  ignoreElements,
  endWith,
  catchError,
  mapTo,
  take
} from "rxjs/operators";
import {Bucket, emptyBucket, LimitExceedBehaviour} from "../../interfaces/bucket";
import {PredefinedDefault} from "../../interfaces/predefined-default";
import {BucketService} from "../../services/bucket.service";
import {BucketHistoryService} from "@spica-client/bucket/services/bucket-history.service";
import {MatDialog} from "@angular/material/dialog";
import {AddFieldModalComponent} from "../add-field-modal/add-field-modal.component";
import { RelationSchemaComponent } from "../../components/relation-schema/relation-schema.component";

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
  readonly iconPageSize = 24;

  icons: Array<string> = ICONS;
  configurationState = "meta";
  searchIconText: string = "";

  visibleIcons: Array<any> = this.icons.slice(0, this.iconPageSize);

  buckets: Bucket[];
  bucket: Bucket;


  $save: Observable<SavingState>;

  $remove: Observable<SavingState>;

  isHistoryEndpointEnabled$: Observable<boolean>;

  propertyPositionMap: {[k: string]: any[]} = {};

  private onDestroy: Subject<void> = new Subject<void>();

  constructor(
    public _inputResolver: InputResolver,
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private bs: BucketService,
    private historyService: BucketHistoryService,
    private dialog: MatDialog
  ) {
    this.inputTypes = _inputResolver.entries();
    this.bs
      .getBuckets()
      .pipe(take(1))
      .subscribe(buckets => (this.buckets = buckets));

  }

  ngOnInit(): void {
    this.isHistoryEndpointEnabled$ = this.historyService
      .historyList("000000000000000000000000", "000000000000000000000000")
      .pipe(
        mapTo(true),
        catchError(() => of(false))
      );

    this.activatedRoute.params 
      .pipe(
        tap(params => {

          this.$save = of(SavingState.Pristine);
          this.$remove = of(SavingState.Pristine);
          if (!params.id) {
            this.bucket = emptyBucket();
            this.updatePositionProperties();

          }
        }),
        filter(params => params.id),
        switchMap(params => this.bs.getBucket(params.id)),
        tap(scheme => {
          this.bucket = deepCopy<Bucket>(scheme);
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
  }

  setPosition(event: CdkDragDrop<any[]>, position?: string) {
    event.previousContainer.data[event.previousIndex].value.options.position = position;
    this.updatePositionProperties();
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

    this.updatePositionProperties();
  }

  saveBucket() { 

    const isInsert = !this.bucket._id;

    if (!this.bucket.hasOwnProperty("order")) {
      this.bucket.order = this.buckets.length;
    }


    const save = isInsert ? this.bs.insertOne(this.bucket) : this.bs.replaceOne(this.bucket);

    this.$save = merge(
      of(SavingState.Saving),
      save.pipe(
        tap(bucket => isInsert && this.router.navigate(["bucket", bucket._id, "add"])),
        ignoreElements(),
        endWith(SavingState.Saved),
        catchError(() => of(SavingState.Failed))
      )
    );
  }

  clearHistories() {
    const remove = this.historyService.clearHistories(this.bucket._id);
    this.$remove = merge(
      of(SavingState.Saving),
      remove.pipe(
        ignoreElements(),
        endWith(SavingState.Saved),
        catchError(() => of(SavingState.Failed))
      )
    );
  }

  createNewField(propertyKey: string = null) {
    let dialogRef = this.dialog.open(AddFieldModalComponent, {
      width: "800px",
      maxHeight: "90vh",
      data: {
        parentSchema: this.bucket,
        propertyKey: propertyKey
      }
    });

    dialogRef.afterClosed().subscribe(data => {
      this.updatePositionProperties();
    });

  }


  ngOnDestroy() {
    this.onDestroy.next();
  }

  onDocumentSettingsChange() {
    if (this.bucket.documentSettings) {
      delete this.bucket.documentSettings;
    } else {
      this.bucket.documentSettings = {
        countLimit: 100,
        limitExceedBehaviour: LimitExceedBehaviour.PREVENT
      };
    }
  }

  setIcons(event = {pageIndex: 0, pageSize: this.iconPageSize}) {
    this.icons = ICONS.filter(icon => icon.includes(this.searchIconText.toLowerCase()));

    this.visibleIcons = this.icons.slice(
      event.pageIndex * event.pageSize,
      (event.pageIndex + 1) * event.pageSize
    );
  }
}
