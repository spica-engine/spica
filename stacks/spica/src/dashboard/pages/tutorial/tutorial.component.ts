import {Component, OnInit, ViewChild, AfterViewInit, EventEmitter, Output} from "@angular/core";
import {Bucket, emptyBucket} from "@spica-client/bucket/interfaces/bucket";
import {BucketService, BucketDataService} from "@spica-client/bucket";
import {InputResolver} from "@spica-client/common";
import {MatStepper} from "@angular/material/stepper";
import {environment} from "environments/environment";
import {ApiKeyService} from "@spica-client/passport/services/apikey.service";
import {switchMap, map} from "rxjs/operators";
import {BucketEntry} from "@spica-client/bucket/interfaces/bucket-entry";
import {emptyApiKey} from "@spica-client/passport/interfaces/apikey";
import {MatSnackBar} from "@angular/material/snack-bar";

@Component({
  selector: "tutorial",
  templateUrl: "./tutorial.component.html",
  styleUrls: ["./tutorial.component.scss"]
})
export class TutorialComponent implements OnInit, AfterViewInit {
  @Output() onDisable = new EventEmitter<any>();

  bucket: Bucket = {...emptyBucket(), properties: {}};
  entry: BucketEntry = {};

  properties = [{key: "", type: "string"}];

  showEntry = false;

  exampleInfo = {
    url: "",
    headers: {
      Authorization: ""
    }
  };

  curl = "";

  readonly inputTypes: string[];

  @ViewChild("stepper", {static: false}) private stepper: MatStepper;

  constructor(
    private _snackBar: MatSnackBar,
    _inputResolver: InputResolver,
    private bucketService: BucketService,
    private bucketDataService: BucketDataService,
    private apikeyService: ApiKeyService
  ) {
    this.inputTypes = _inputResolver
      .entries()
      .filter(
        type => !(type == "array" || type == "storage" || type == "object" || type == "relation")
      );
  }

  ngOnInit() {}

  ngAfterViewInit() {
    this.stepper.steps.forEach(step => (step.completed = false));
  }

  addProperty() {
    this.properties.push({key: "", type: "string"});
  }

  removeProperty(index: number) {
    this.properties = this.properties.filter((_, i) => i != index);
  }

  saveSchema() {
    if (this.isSchemaInvalid()) {
      return;
    }

    this.bucket.properties = this.properties.reduce((acc, curr) => {
      acc[curr.key] = {
        title: curr.key,
        type: this.inputTypes.indexOf(curr.type) > -1 ? curr.type : "string",
        description: `Description of ${curr.key}`,
        options: {
          position: "bottom"
        }
      };
      return acc;
    }, {});

    this.bucket.primary = this.properties[0].key;

    this.bucketService
      .insertOne(this.bucket)
      .toPromise()
      .then(bucket => {
        this.bucket = bucket;
        this.properties.forEach(prop => (this.entry[prop.key] = undefined));
        this.stepper.selected.completed = true;
        this.stepper.next();
      });
  }

  insertEntry() {
    this.apikeyService
      .insertOne({...emptyApiKey(), name: "tutorial"})
      .pipe(
        switchMap(apikey => this.apikeyService.attachPolicy("BucketFullAccess", apikey._id)),
        switchMap(apikey =>
          this.bucketDataService.insertOne(this.bucket._id, this.entry).pipe(
            map(entry => {
              return {entry: entry, apikey: apikey};
            })
          )
        )
      )
      .toPromise()
      .then(({entry, apikey}) => {
        this.entry = entry;

        this.curl = this.createCURL(this.bucket._id, entry._id, apikey.key);
        this.exampleInfo.url = this.createUrl(this.bucket._id, entry._id);
        this.exampleInfo.headers.Authorization = `APIKEY ${apikey.key}`;

        this.stepper.selected.completed = true;
        this.stepper.next();
        this._snackBar.open(
          "Congratulations. You have completed the tutorial. Please follow the documentation to continue development for your project.",
          "",
          {
            duration: 5000
          }
        );
      });
  }

  createUrl(bucketId: string, entryId: string) {
    return `${environment.api}/bucket/${bucketId}/data/${entryId}`;
  }

  createCURL(bucketId: string, entryId: string, apikey: string) {
    if (!environment.api || !bucketId || !entryId || !apikey) {
      return;
    }
    let url = this.createUrl(bucketId, entryId);
    return `curl -H "Authorization:APIKEY ${apikey}" ${url}`;
  }

  isSchemaInvalid() {
    let hasUndefinedKey = false;
    let hasDuplicatedKey = false;
    this.properties.reduce((acc, curr) => {
      if (!curr.key) {
        hasUndefinedKey = true;
      } else if (acc.includes(curr.key)) {
        hasDuplicatedKey = true;
      } else {
        acc.push(curr.key);
      }
      return acc;
    }, []);

    return !!(hasUndefinedKey || hasDuplicatedKey);
  }

  hideTutorial() {
    this.onDisable.next(null);
  }
}
