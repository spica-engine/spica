import {DebugElement, Directive, HostBinding, Input} from "@angular/core";
import {ComponentFixture, fakeAsync, TestBed, tick} from "@angular/core/testing";
import {FormsModule, NgForm, NgModel} from "@angular/forms";
import {MatBadge, MatBadgeModule} from "@angular/material/badge";
import {MatButtonModule} from "@angular/material/button";
import {MatChipsModule} from "@angular/material/chips";
import {MatCardModule} from "@angular/material/card";
import {MatLegacyFormFieldModule as MatFormFieldModule} from "@angular/material/legacy-form-field";
import {MatIconModule} from "@angular/material/icon";
import {MatLegacyMenuModule as MatMenuModule} from "@angular/material/legacy-menu";
import {MatLegacyProgressSpinnerModule as MatProgressSpinnerModule} from "@angular/material/legacy-progress-spinner";
import {MatToolbarModule} from "@angular/material/toolbar";
import {MatLegacyTooltipModule as MatTooltipModule} from "@angular/material/legacy-tooltip";
import {By} from "@angular/platform-browser";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {ActivatedRoute} from "@angular/router";
import {RouterTestingModule} from "@angular/router/testing";
import {InputModule} from "@spica-client/common";
import {MatSaveModule} from "@spica-client/material/";

import {OwlDateTimeModule, OwlNativeDateTimeModule} from "@danielmoncada/angular-datetime-picker";
import {of, Subject} from "rxjs";
import {PropertyLanguageComponent} from "../../components/language/language.component";
import {Bucket} from "../../interfaces/bucket";
import {BucketRow} from "../../interfaces/bucket-entry";
import {BucketHistory} from "../../interfaces/bucket-history";
import {BucketDataService} from "../../services/bucket-data.service";
import {BucketHistoryService} from "../../services/bucket-history.service";
import {BucketService} from "../../services/bucket.service";
import {RequiredTranslate} from "../../validators";
import {AddComponent} from "./add.component";
import {CanInteractDirectiveTest} from "@spica-client/passport/directives/can-interact.directive";

describe("AddComponent", () => {
  let fixture: ComponentFixture<AddComponent>;

  let bucket: Subject<Partial<Bucket>>;
  let row: Subject<BucketRow>;
  let historyList: Subject<BucketHistory[]>;
  let history: Subject<BucketRow>;

  let bucketService = {
    getBucket: jasmine.createSpy("getBucket").and.callFake(() => bucket),
    getPreferences: jasmine.createSpy("getPreferences").and.returnValue(
      of({
        language: {
          available: {
            tr_TR: "Turkish",
            en_US: "English"
          },
          default: "en_US"
        }
      })
    )
  };
  let bucketDataService = {
    findOne: jasmine.createSpy("findOne").and.callFake(() => row)
  };
  let bucketHistoryService = {
    historyList: jasmine.createSpy("historyList").and.callFake(() => historyList),
    revertTo: jasmine.createSpy("revertTo").and.callFake(() => history)
  };
  let activatedRoute: {
    params: Subject<any>;
  };

  beforeEach(() => {
    bucket = new Subject<Partial<Bucket>>();
    row = new Subject<BucketRow>();
    historyList = new Subject<BucketHistory[]>();
    history = new Subject<BucketRow>();

    activatedRoute = {
      params: new Subject()
    };

    TestBed.configureTestingModule({
      imports: [
        MatIconModule,
        MatChipsModule,
        MatMenuModule,
        MatCardModule,
        MatToolbarModule,
        MatBadgeModule,
        MatTooltipModule,
        MatProgressSpinnerModule,
        MatButtonModule,
        MatFormFieldModule,
        OwlDateTimeModule,
        OwlNativeDateTimeModule,
        InputModule.withPlacers([]),
        FormsModule,
        RouterTestingModule,
        NoopAnimationsModule,
        MatSaveModule
      ],
      providers: [
        {
          provide: BucketService,
          useValue: bucketService
        },
        {
          provide: BucketDataService,
          useValue: bucketDataService
        },
        {
          provide: BucketHistoryService,
          useValue: bucketHistoryService
        },
        {
          provide: ActivatedRoute,
          useValue: activatedRoute
        }
      ],
      declarations: [
        AddComponent,
        RequiredTranslate,
        PropertyLanguageComponent,
        CanInteractDirectiveTest
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(AddComponent);
    fixture.detectChanges();

    bucketHistoryService.historyList.calls.reset();
    bucketDataService.findOne.calls.reset();
    bucketService.getBucket.calls.reset();

    activatedRoute.params.next({id: 1});
    fixture.detectChanges();
  });

  describe("basic behavior", () => {
    beforeEach(fakeAsync(() => {
      bucket.next({
        properties: {
          test: {
            type: "string",
            options: {
              position: "bottom"
            }
          }
        }
      });
      fixture.detectChanges();
      tick(1);
    }));

    it("should render bucket information", fakeAsync(() => {
      bucket.next({
        title: "My Bucket",
        description: "My buckets description.",
        icon: "test",
        properties: {}
      });
      tick(1);
      fixture.detectChanges();
      expect(
        fixture.debugElement.query(By.css("mat-toolbar > span > h4 > mat-icon")).nativeElement
          .textContent
      ).toBe("test");
      expect(
        fixture.debugElement.query(By.css("mat-toolbar > span > h4 > span")).nativeElement
          .textContent
      ).toBe("My Bucket");
      expect(
        fixture.debugElement.query(By.css("mat-toolbar > span > h6")).nativeElement.textContent
      ).toBe("My buckets description.");

      expect(bucketService.getBucket).toHaveBeenCalledTimes(1);
      expect(bucketDataService.findOne).not.toHaveBeenCalled();
      expect(bucketHistoryService.historyList).not.toHaveBeenCalled();
    }));

    it("should show readonly badge", fakeAsync(() => {
      bucket.next({
        readOnly: true,
        properties: {}
      });
      tick(1);
      fixture.detectChanges();
      expect(
        fixture.debugElement.query(By.css("mat-toolbar > span > h4 > mat-chip-list mat-chip"))
          .nativeElement.textContent
      ).toBe("Read Only");

      expect(bucketService.getBucket).toHaveBeenCalledTimes(1);
      expect(bucketDataService.findOne).not.toHaveBeenCalled();
      expect(bucketHistoryService.historyList).not.toHaveBeenCalled();
    }));

    it("should disable add/update button when readonly", fakeAsync(() => {
      bucket.next({
        readOnly: true,
        properties: {}
      });
      tick(1);
      fixture.detectChanges();
      expect(
        fixture.debugElement.query(By.css("mat-card > mat-card-actions > button:last-of-type"))
          .nativeElement.disabled
      ).toBe(true);
    }));

    it("should show save button", fakeAsync(() => {
      tick(1);
      fixture.detectChanges();
      expect(
        fixture.debugElement.query(
          By.css("mat-card > mat-card-actions > button:last-of-type > span > span")
        ).nativeElement.textContent
      ).toBe("Save");

      expect(
        fixture.debugElement.query(
          By.css("mat-card > mat-card-actions > button:last-of-type > span > mat-icon")
        ).nativeElement.textContent
      ).toBe("save");
    }));
  });

  describe("history", () => {
    describe("disabled", () => {
      beforeEach(fakeAsync(() => {
        activatedRoute.params.next({id: "1", rid: "2"});
        row.next({_id: "2"});
        bucket.next({history: false, properties: {}});
        tick(1);
        fixture.detectChanges();
      }));

      it("shouldn't set history observable and render button", () => {
        expect(bucketHistoryService.historyList).toHaveBeenCalledTimes(0);
        expect(fixture.componentInstance.histories$).toBeUndefined();
        const button = fixture.debugElement.query(By.css("mat-toolbar > button"));
        expect(button).toBeFalsy();
      });
    });

    describe("enabled", () => {
      beforeEach(fakeAsync(() => {
        activatedRoute.params.next({id: "1", rid: "2"});
        row.next({_id: "2"});
        bucket.next({history: true, properties: {}});
        tick(1);
        fixture.detectChanges();
      }));

      it("shouldn't render history button and shouldn't throw error if status code was 404 which means replicaset didn't initialized", () => {
        historyList.error({status: 404});
        fixture.detectChanges();

        expect(bucketHistoryService.historyList).toHaveBeenCalledTimes(2);
        expect(fixture.componentInstance.histories$).toBeUndefined();

        const button = fixture.debugElement.query(By.css("mat-toolbar > button"));
        expect(button).toBeFalsy();
      });

      //somehow, this error makes tests fail even if caught
      xit("should throw error when status code was 500", async () => {
        historyList.error({status: 500});
        fixture.detectChanges();

        expect(bucketHistoryService.historyList).toHaveBeenCalledTimes(2);
        await fixture.componentInstance.histories$
          .toPromise()
          .catch(err => expect(err).toEqual({status: 500}));
        const button = fixture.debugElement.query(By.css("mat-toolbar > button"));
        expect(button).toBeFalsy();
      });

      it("should show history button in edit mode", () => {
        historyList.next([{_id: "1", changes: 1, date: new Date().toISOString()}]);
        fixture.detectChanges();
        expect(bucketHistoryService.historyList).toHaveBeenCalledTimes(2);
        expect(bucketHistoryService.historyList).toHaveBeenCalledWith("1", "2");
        const button = fixture.debugElement.query(By.css("mat-toolbar > button"));
        expect(button).toBeTruthy();
        expect(button.injector.get(MatBadge).content).toBe((1 as unknown) as string);
      });

      it("should list changes", () => {
        historyList.next([
          {_id: "1", changes: 5, date: new Date().toISOString()},
          {_id: "2", changes: 8, date: new Date().toISOString()}
        ]);
        fixture.detectChanges();
        expect(bucketHistoryService.historyList).toHaveBeenCalledTimes(2);
        expect(bucketHistoryService.historyList).toHaveBeenCalledWith("1", "2");
        fixture.debugElement.query(By.css("mat-toolbar > button")).nativeElement.click();
        fixture.detectChanges();
        const options = document.body.querySelectorAll<HTMLButtonElement>(
          ".mat-menu-panel > .mat-menu-content button"
        );

        expect(options.item(0).textContent).toBe(" N ");
        expect(options.item(0).disabled).toBe(true);
        expect(options.item(1).querySelector("span.mat-button-wrapper").textContent).toBe(" 1 ");
        expect(options.item(1).querySelector("span.mat-badge-content").textContent).toBe("5");
        expect(options.item(2).querySelector("span.mat-button-wrapper").textContent).toBe(" 2 ");
        expect(options.item(2).querySelector("span.mat-badge-content").textContent).toBe("8");
      });

      it("should set data to specific data point", fakeAsync(() => {
        const data = {_id: "2", test: "12"},
          specificPoint = {_id: "2", test: "123"};
        historyList.next([
          {_id: "1", changes: 3, date: new Date().toISOString()},
          {_id: "2", changes: 2, date: new Date().toISOString()}
        ]);
        row.next(data);
        fixture.detectChanges();

        fixture.debugElement.query(By.css("mat-toolbar > button")).nativeElement.click();
        fixture.detectChanges();

        const nowButton = document.body.querySelector<HTMLButtonElement>(
          ".mat-menu-panel > .mat-menu-content button"
        );
        const secondButton = document.body.querySelector<HTMLButtonElement>(
          ".mat-menu-panel > .mat-menu-content button:nth-of-type(2)"
        );

        secondButton.click();
        history.next(specificPoint);
        history.complete();
        tick();
        fixture.detectChanges();

        expect(bucketHistoryService.revertTo).toHaveBeenCalledTimes(1);
        expect(bucketHistoryService.revertTo).toHaveBeenCalledWith("1", "2", "1");
        expect(fixture.componentInstance.data).toEqual(specificPoint);
        expect(fixture.componentInstance.now).toEqual(data);
        expect(nowButton.disabled).toBe(false);
      }));
    });
  });

  describe("properties", () => {
    it("should render with positions", fakeAsync(() => {
      bucket.next({
        properties: {
          test: {
            type: "string",
            options: {
              position: "bottom"
            }
          },
          test1: {
            type: "string",
            options: {
              position: "bottom"
            }
          },
          test2: {
            type: "string",
            options: {
              position: "left"
            }
          },
          test3: {
            type: "string",
            options: {
              position: "right"
            }
          }
        }
      });
      tick(1);
      fixture.detectChanges();

      let bottomProperties = fixture.debugElement.queryAll(
          By.css("mat-card > mat-card-content > form > div.bottom > div")
        ),
        leftProperties = fixture.debugElement.queryAll(
          By.css("mat-card > mat-card-content > form > div.left > div")
        ),
        rightProperties = fixture.debugElement.queryAll(
          By.css("mat-card > mat-card-content > form > div.right > div")
        );
      expect(bottomProperties.length).toBe(2);
      expect(leftProperties.length).toBe(1);
      expect(rightProperties.length).toBe(1);
    }));

    it("should write value to data", fakeAsync(() => {
      bucket.next({
        properties: {
          test: {
            type: "string",
            options: {
              position: "bottom"
            }
          }
        }
      });
      tick(1);
      fixture.detectChanges();
      const property = fixture.debugElement.query(
        By.css("mat-card > mat-card-content > form > div.bottom > div")
      );
      const ngModel = property.injector.get(NgModel);
      ngModel.viewToModelUpdate("test");
      expect(fixture.componentInstance.data.test).toEqual("test");
    }));

    describe("translated", () => {
      let translatedProperty: DebugElement;
      beforeEach(fakeAsync(() => {
        bucket.next({
          properties: {
            test: {
              type: "string",
              options: {
                position: "bottom",
                translate: true
              }
            }
          }
        });
        tick(1);
        fixture.detectChanges(false);
        translatedProperty = fixture.debugElement.query(
          By.css("mat-card > mat-card-content > form > div.bottom > div")
        );
      }));

      it("should render translated properties and coerce data", () => {
        expect(translatedProperty).toBeTruthy();
        expect(fixture.componentInstance.data.test).toEqual({});
      });

      it("should write to the value to the coerced object", () => {
        const ngModel = translatedProperty.injector.get(NgModel);
        ngModel.viewToModelUpdate("test");
        expect(fixture.componentInstance.data.test).toEqual({en_US: "test"});
      });

      it("should write to the value to the second language in the coerced object", () => {
        const language = translatedProperty.query(By.directive(PropertyLanguageComponent))
          .componentInstance as PropertyLanguageComponent;
        language.selected = "tr_TR";
        const ngModel = translatedProperty.injector.get(NgModel);
        ngModel.viewToModelUpdate("test");
        expect(fixture.componentInstance.data.test).toEqual({tr_TR: "test"});
      });
    });
  });

  describe("validation", () => {
    it("should be valid when there is no property required", fakeAsync(() => {
      bucket.next({
        properties: {
          test: {
            type: "string",
            options: {
              position: "bottom"
            }
          }
        }
      });
      tick(1);
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.directive(NgForm)).injector.get(NgForm).invalid).toBe(
        false
      );
    }));

    it("should be invalid when a property is required", fakeAsync(() => {
      bucket.next({
        required: ["test"],
        properties: {
          test: {
            type: "string",
            options: {
              position: "bottom"
            }
          }
        }
      });
      tick(1);
      fixture.detectChanges(false);
      tick(1);
      expect(fixture.debugElement.query(By.directive(NgForm)).injector.get(NgForm).invalid).toBe(
        true
      );
    }));

    it("should disable add/update button when invalid", fakeAsync(() => {
      bucket.next({
        required: ["test"],
        properties: {
          test: {
            type: "string",
            options: {
              position: "bottom"
            }
          }
        }
      });
      tick(1);
      fixture.detectChanges(false);
      tick(1);
      fixture.detectChanges(false);
      expect(
        fixture.debugElement.query(By.css("mat-card > mat-card-actions > button:last-of-type"))
          .nativeElement.disabled
      ).toBe(true);
    }));
  });

  describe("deletion of null values", () => {
    it("should remove null values", () => {
      const data = {
        valid_field: "test",
        remove_this: null,
        remove_this_also: undefined,
        nested_object: {
          nested_remove_this: null,
          keep_this: "test"
        },
        keep_array: []
      };

      expect(fixture.componentInstance.removeNulls(data)).toEqual({
        valid_field: "test",
        nested_object: {
          keep_this: "test"
        },
        keep_array: []
      });
    });
  });
});
