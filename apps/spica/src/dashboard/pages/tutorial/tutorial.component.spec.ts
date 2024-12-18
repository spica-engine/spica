import {ComponentFixture, TestBed, tick, fakeAsync, flush} from "@angular/core/testing";
import {TutorialComponent} from "./tutorial.component";
import {InputModule} from "@spica-client/common";
import {BucketService, BucketDataService} from "@spica-client/bucket";
import {ApiKeyService} from "@spica-client/passport/services/apikey.service";
import {HttpClientTestingModule} from "@angular/common/http/testing";
import {MatStepperModule} from "@angular/material/stepper";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatInputModule} from "@angular/material/input";
import {MatSelectModule} from "@angular/material/select";
import {MatTabsModule} from "@angular/material/tabs";
import {MatDividerModule} from "@angular/material/divider";
import {of} from "rxjs";
import {environment} from "environments/environment";
import {MatSnackBarModule} from "@angular/material/snack-bar";
import {MatClipboardModule} from "@spica-client/material";
import {MatIconModule} from "@angular/material/icon";
import {MatTooltipModule} from "@angular/material/tooltip";
import {FormsModule} from "@angular/forms";

describe("TutorialComponent", () => {
  let fixture: ComponentFixture<TutorialComponent>;

  let nextSpy: jest.Mock;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        InputModule,
        HttpClientTestingModule,
        MatStepperModule,
        NoopAnimationsModule,
        MatInputModule,
        MatFormFieldModule,
        MatTabsModule,
        MatSelectModule,
        MatDividerModule,
        MatSnackBarModule,
        MatClipboardModule,
        MatIconModule,
        MatTooltipModule,
        FormsModule
      ],
      declarations: [TutorialComponent],
      providers: [
        {
          provide: BucketService,
          useValue: {
            insertOne: (bucket: any) => {
              return of(bucket);
            }
          }
        },
        {
          provide: BucketDataService,
          useValue: {
            insertOne: (bucketId: string, entry: any) => {
              return of(entry);
            }
          }
        },
        {
          provide: ApiKeyService,
          useValue: {
            insertOne: (apikey: any) => {
              return of(apikey);
            },
            attachPolicy: (policyId: string, apikeyId: string) => {
              return of();
            }
          }
        }
      ]
    }).compileComponents();
  });

  beforeEach(() => {
    environment.api = "public_host/api";
    fixture = TestBed.createComponent(TutorialComponent);
    fixture.detectChanges();
    nextSpy = jest.spyOn(fixture.componentInstance["stepper"], "next");
  });

  it("should show available types", () => {
    expect(fixture.componentInstance.inputTypes).toEqual([
      "string",
      "date",
      "number",
      "boolean",
      "textarea",
      "multiselect",
      "color"
    ]);
  });

  it("should mark all steps as uncompleted which means next step will be disabled until current one completed", () => {
    fixture.componentInstance["stepper"].steps.forEach(step => expect(step.completed).toBe(false));
    expect(fixture.componentInstance["stepper"].selectedIndex).toBe(0);
  });

  it("should return true when schema is invalid", () => {
    fixture.componentInstance.properties = [
      {key: "field1", type: "string"},
      {key: "field1", type: "number"}
    ];

    expect(fixture.componentInstance.isSchemaInvalid()).toBe(
      true,
      "It should return true when schema has duplicated keys"
    );

    fixture.componentInstance.properties = [
      {key: "", type: "string"},
      {key: "field1", type: "number"}
    ];

    expect(fixture.componentInstance.isSchemaInvalid()).toBe(
      true,
      "It should return true when schema has undefined key"
    );
  });

  it("should return false when schema is valid", () => {
    fixture.componentInstance.properties = [
      {
        key: "field1",
        type: "string"
      },
      {
        key: "field2",
        type: "string"
      }
    ];

    expect(fixture.componentInstance.isSchemaInvalid()).toBe(false);
  });

  it("should emit emitter to hide tutorial", () => {
    let emitSpy = jest.spyOn(fixture.componentInstance.onDisable, "next");
    fixture.componentInstance.hideTutorial();
    expect(emitSpy).toHaveBeenCalledTimes(1);
  });

  it("should add property", () => {
    fixture.componentInstance.addProperty();
    expect(fixture.componentInstance.properties).toEqual([
      {key: "", type: "string"},
      {key: "", type: "string"}
    ]);
  });

  it("should remove property", () => {
    fixture.componentInstance.addProperty();

    fixture.componentInstance.properties[1].key = "test";
    fixture.componentInstance.properties[1].type = "date";

    fixture.componentInstance.removeProperty(1);

    expect(fixture.componentInstance.properties).toEqual([{key: "", type: "string"}]);
  });

  it("should save bucket schema", fakeAsync(() => {
    let bucketInsert = jest.spyOn(
      fixture.componentInstance["bucketService"],
      "insertOne"
    );

    fixture.componentInstance.properties[0].key = "test";
    fixture.componentInstance.properties[0].type = "number";

    fixture.componentInstance.saveSchema();

    expect(bucketInsert).toHaveBeenCalledTimes(1);
    expect(bucketInsert).toHaveBeenCalledWith({
      title: "New Bucket",
      description: "Describe your new bucket",
      icon: "view_stream",
      primary: "test",
      readOnly: false,
      history: false,
      acl: {
        write: "true==true",
        read: "true==true"
      },
      properties: {
        test: {
          title: "test",
          type: "number",
          description: `Description of test`,
          options: {
            position: "bottom"
          }
        }
      }
    });

    tick();

    expect(fixture.componentInstance.entry).toEqual({test: undefined});
    expect(fixture.componentInstance["stepper"].steps.map(step => step.completed)).toEqual([
      true,
      false,
      false
    ]);
    expect(nextSpy).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance["stepper"].selectedIndex).toBe(1);
  }));

  xit("should insert entry", fakeAsync(() => {
    //mark first step as completed before complete second step
    fixture.componentInstance["stepper"].steps.first.completed = true;
    fixture.componentInstance["stepper"].next();

    flush();

    let apikeyInsert = jest.spyOn(fixture.componentInstance["apikeyService"], "insertOne").mockImplementation(
      (apikey: any) => {
        return of({...apikey, _id: "apikey_id"});
      }
    );

    let apikeyAttach = jest.spyOn(
      fixture.componentInstance["apikeyService"],
      "attachPolicy"
    ).mockImplementation((policyId: string, apikeyId: string) => {
      return of({
        active: true,
        name: "tutorial",
        policies: [policyId],
        _id: "apikey_id",
        key: "key"
      });
    });

    let bucketDataInsert = jest.spyOn(
      fixture.componentInstance["bucketDataService"],
      "insertOne"
    );

    fixture.componentInstance.entry = {
      _id: "bucketdata_id",
      test: "test"
    };
    fixture.componentInstance.bucket._id = "bucket_id";

    fixture.componentInstance.insertEntry();

    tick(100);

    expect(apikeyInsert).toHaveBeenCalledTimes(1);
    expect(apikeyInsert).toHaveBeenCalledWith({
      active: true,
      name: "tutorial",
      policies: []
    });

    expect(apikeyAttach).toHaveBeenCalledTimes(1);
    expect(apikeyAttach).toHaveBeenCalledWith("BucketFullAccess", "apikey_id");

    expect(bucketDataInsert).toHaveBeenCalledTimes(1);
    expect(bucketDataInsert).toHaveBeenCalledWith("bucket_id", {
      _id: "bucketdata_id",
      test: "test"
    });

    expect(fixture.componentInstance.entry).toEqual({_id: "bucketdata_id", test: "test"});
    expect(fixture.componentInstance.curl).toEqual(
      'curl -H "Authorization:APIKEY key" public_host/api/bucket/bucket_id/data/bucketdata_id'
    );
    expect(fixture.componentInstance.exampleInfo).toEqual({
      url: "public_host/api/bucket/bucket_id/data/bucketdata_id",
      headers: {Authorization: "APIKEY key"}
    });

    expect(fixture.componentInstance["stepper"].steps.map(step => step.completed)).toEqual([
      true,
      true,
      false
    ]);
    expect(nextSpy).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance["stepper"].selectedIndex).toBe(2);
  }));
});
