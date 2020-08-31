import {ComponentFixture, TestBed, tick, fakeAsync} from "@angular/core/testing";
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

describe("TutorialComponent", () => {
  let fixture: ComponentFixture<TutorialComponent>;

  let nextSpy: jasmine.Spy;

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
        MatDividerModule
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
    nextSpy = spyOn(fixture.componentInstance["stepper"], "next").and.callThrough();
  });

  it("should show available types", () => {
    expect(fixture.componentInstance.inputTypes).toEqual([
      "string",
      "date",
      "number",
      "boolean",
      "textarea",
      "color"
    ]);
  });

  it("should mark all steps as uncompleted which means next step will be disabled until current one completed", () => {
    fixture.componentInstance["stepper"].steps.forEach(step => expect(step.completed).toBe(false));
    expect(fixture.componentInstance["stepper"].selectedIndex).toBe(0);
  });

  it("should add property", () => {
    fixture.componentInstance.addProperty("test", "string");
    expect(fixture.componentInstance.bucket.properties).toEqual({
      test: {
        title: "test",
        type: "string",
        description: `Description of test`,
        options: {
          position: "bottom",
          visible: true
        }
      }
    });
  });

  it("should return property length", () => {
    fixture.componentInstance.addProperty("test", "string");
    fixture.componentInstance.addProperty("test2", "string");

    expect(fixture.componentInstance.properyLength()).toEqual(2);
  });

  it("should remove property", () => {
    fixture.componentInstance.addProperty("test", "string");
    fixture.componentInstance.addProperty("test2", "string");

    fixture.componentInstance.removeProperty("test");

    expect(fixture.componentInstance.bucket.properties).toEqual({
      test2: {
        title: "test2",
        type: "string",
        description: `Description of test2`,
        options: {
          position: "bottom",
          visible: true
        }
      }
    });
  });

  it("should save bucket schema", fakeAsync(() => {
    let bucketInsert = spyOn(
      fixture.componentInstance["bucketService"],
      "insertOne"
    ).and.callThrough();

    fixture.componentInstance.addProperty("test", "string");
    fixture.componentInstance.saveSchema();

    expect(bucketInsert).toHaveBeenCalledTimes(1);
    expect(bucketInsert).toHaveBeenCalledWith({
      title: "New Bucket",
      description: "Describe your new bucket",
      icon: "view_stream",
      primary: "test",
      readOnly: false,
      history: false,
      properties: {
        test: {
          title: "test",
          type: "string",
          description: `Description of test`,
          options: {
            position: "bottom",
            visible: true
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

  it("should insert entry", fakeAsync(() => {
    //mark first step as completed before complete second step
    fixture.componentInstance["stepper"].steps.first.completed = true;
    fixture.componentInstance["stepper"].next();

    let apikeyInsert = spyOn(fixture.componentInstance["apikeyService"], "insertOne").and.callFake(
      (apikey: any) => {
        return of({...apikey, _id: "apikey_id"});
      }
    );

    let apikeyAttach = spyOn(
      fixture.componentInstance["apikeyService"],
      "attachPolicy"
    ).and.callFake((policyId: string, apikeyId: string) => {
      return of({
        active: true,
        name: "tutorial",
        policies: [policyId],
        _id: "apikey_id",
        key: "key"
      });
    });

    let bucketDataInsert = spyOn(
      fixture.componentInstance["bucketDataService"],
      "insertOne"
    ).and.callThrough();

    fixture.componentInstance.entry = {
      _id: "bucketdata_id",
      test: "test"
    };
    fixture.componentInstance.bucket._id = "bucket_id";

    fixture.componentInstance.insertEntry();

    tick();

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
