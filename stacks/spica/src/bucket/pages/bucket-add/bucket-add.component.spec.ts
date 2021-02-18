import {CdkDropList, DragDropModule} from "@angular/cdk/drag-drop";
import {ComponentFixture, fakeAsync, TestBed, tick} from "@angular/core/testing";
import {FormsModule, NgForm, NgModel} from "@angular/forms";
import {MatButtonModule} from "@angular/material/button";
import {MatCardModule} from "@angular/material/card";
import {MatCheckboxModule} from "@angular/material/checkbox";
import {MatOptionModule} from "@angular/material/core";
import {MatDividerModule} from "@angular/material/divider";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatGridListModule} from "@angular/material/grid-list";
import {MatIconModule} from "@angular/material/icon";
import {MatInputModule} from "@angular/material/input";
import {MatListModule} from "@angular/material/list";
import {MatMenuModule} from "@angular/material/menu";
import {MatPaginatorModule} from "@angular/material/paginator";
import {MatProgressSpinnerModule} from "@angular/material/progress-spinner";
import {MatSelectModule} from "@angular/material/select";
import {MatSlideToggleModule} from "@angular/material/slide-toggle";
import {MatToolbarModule} from "@angular/material/toolbar";
import {MatTooltipModule} from "@angular/material/tooltip";
import {By} from "@angular/platform-browser";
import {EditorModule} from "@spica-client/common/code-editor";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {ActivatedRoute} from "@angular/router";
import {InputModule} from "@spica-client/common";
import {MatSaveModule} from "@spica-client/material";
import {of} from "rxjs";
import {Bucket} from "src/bucket/interfaces/bucket";
import {BucketHistoryService} from "src/bucket/services/bucket-history.service";
import {BucketService} from "src/bucket/services/bucket.service";
import {PropertyKvPipe} from "@spica-client/common/pipes";
import {CanInteractDirectiveTest} from "@spica-client/passport/directives/can-interact.directive";
import {BucketAddComponent} from "./bucket-add.component";
import {MatAwareDialogModule} from "@spica-client/material/aware-dialog";
import {BucketIndexComponent} from "../bucket-index/bucket-index.component";
import {RouterTestingModule} from "@angular/router/testing";
import {MatButtonToggleModule} from "@angular/material/button-toggle";


describe("BucketAddComponent", () => {
  let fixture: ComponentFixture<BucketAddComponent>;

  let myBucket = {
    _id: "123",
    title: "my bucket",
    description: "description",
    primary: "prop1",
    icon: "myIcon",
    required: ["prop1"],
    readOnly: false,
    history: true,
    acl: {
      write: "true==true",
      read: "true==true"
    },
    properties: {
      prop1: {
        type: "string",
        title: "title of prop1",
        description: "description of prop1",
        options: {
          position: "left",
          visible: true,
          translate: true
        }
      },
      prop2: {
        type: "textarea",
        title: "title of prop2",
        description: "description of prop2",
        options: {
          position: "right",
          visible: false,
          translate: false
        }
      }
    }
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        DragDropModule,
        MatProgressSpinnerModule,
        MatButtonToggleModule,
        MatCardModule,
        MatGridListModule,
        MatSelectModule,
        MatOptionModule,
        MatButtonModule,
        MatCheckboxModule,
        MatIconModule,
        FormsModule,
        MatSlideToggleModule,
        MatListModule,
        MatDividerModule,
        MatFormFieldModule,
        MatInputModule,
        MatMenuModule,
        MatTooltipModule,
        MatPaginatorModule,
        MatToolbarModule,
        EditorModule,
        NoopAnimationsModule,

        InputModule.withPlacers([]),
        MatSaveModule,
        MatAwareDialogModule,
        RouterTestingModule
      ],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            params: of({
              id: "id1"
            }),
            url: of(["id1"])
          }
        },
        {
          provide: BucketService,
          useValue: {
            getBucket: jasmine.createSpy("getBucket").and.returnValue(of(myBucket)),
            replaceOne: jasmine.createSpy("replaceOne").and.returnValue(of(myBucket)),
            getBuckets: jasmine.createSpy("getBuckets").and.returnValue(of([myBucket]))
          }
        },
        {
          provide: BucketHistoryService,
          useValue: {
            clearHistories: jasmine.createSpy("clearHistories").and.returnValue(of(undefined)),
            historyList: jasmine.createSpy("historyList").and.returnValue(of(undefined))
          }
        }
      ],
      declarations: [
        BucketAddComponent,
        BucketIndexComponent,
        PropertyKvPipe,
        CanInteractDirectiveTest
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(BucketAddComponent);
    fixture.detectChanges();
  });

  describe("basic behaviours", () => {
    it("should be defined when component created", () => {
      expect(fixture.componentInstance.bucket).toEqual(myBucket as Bucket);
      expect(fixture.componentInstance.propertyPositionMap).toEqual({
        left: [
          {
            key: "prop1",
            value: {
              type: "string",
              description: "description of prop1",
              title: "title of prop1",
              options: {position: "left", visible: true, translate: true}
            }
          }
        ],
        right: [
          {
            key: "prop2",
            value: {
              type: "textarea",
              description: "description of prop2",
              title: "title of prop2",
              options: {
                position: "right",
                visible: false,
                translate: false
              }
            }
          }
        ],
        bottom: []
      });
      expect(fixture.componentInstance.isThereVisible).toBe(true);
    });

    it("should render component", () => {
      expect(
        fixture.debugElement.query(By.css("h4 > button mat-icon")).nativeElement.textContent
      ).toBe("myIcon");

      expect(
        fixture.debugElement.query(By.css("div.right-content h4 > span")).nativeElement.textContent
      ).toBe("my bucket");

      const form = fixture.debugElement.query(By.css("mat-card mat-list-item:first-of-type form"));

      expect(
        form
          .query(By.css("mat-form-field:nth-child(1)"))
          .query(By.directive(NgModel))
          .injector.get(NgModel).model
      ).toBe("my bucket");

      expect(
        form
          .query(By.css("mat-form-field:nth-child(2)"))
          .query(By.directive(NgModel))
          .injector.get(NgModel).model
      ).toBe("description");

      expect(
        form.query(By.css(".toggles .read-only mat-slide-toggle")).injector.get(NgModel).model
      ).toBe(false, "should work if readonly value is false");

      expect(
        form.query(By.css(".toggles .history mat-slide-toggle")).injector.get(NgModel).model
      ).toBe(true, "should work if history value is true");

      expect(
        fixture.debugElement
          .query(By.css("mat-card mat-list-item.padding-24 mat-grid-tile:nth-child(1)"))
          .injector.get(CdkDropList).data
      ).toEqual([
        {
          key: "prop1",
          value: {
            type: "string",
            description: "description of prop1",
            title: "title of prop1",
            options: {position: "left", visible: true, translate: true}
          }
        }
      ]);

      expect(
        fixture.debugElement
          .query(By.css("mat-card mat-list-item.padding-24 mat-grid-tile:nth-child(2)"))
          .injector.get(CdkDropList).data
      ).toEqual([
        {
          key: "prop2",
          value: {
            type: "textarea",
            description: "description of prop2",
            title: "title of prop2",
            options: {
              position: "right",
              visible: false,
              translate: false
            }
          }
        }
      ]);

      expect(
        fixture.debugElement
          .query(By.css("mat-card mat-list-item.padding-24 mat-grid-tile:nth-child(3)"))
          .injector.get(CdkDropList).data
      ).toEqual([], "should work if bottom is empty");

      expect(
        fixture.debugElement.query(By.css("mat-card mat-card-actions button mat-icon"))
          .nativeElement
      ).toBeDefined("should work if savingstate is false as default");
    });

    it("should render disabled history toggle and error", async () => {
      fixture.componentInstance.isHistoryEndpointEnabled$ = of(false);
      fixture.detectChanges();

      expect(
        fixture.debugElement.query(By.css(".history mat-slide-toggle")).componentInstance.disabled
      ).toEqual(true);

      expect(
        fixture.debugElement.query(By.css(".toggles mat-error")).nativeElement.textContent
      ).toEqual(" This feature is unavailable. ");
    });
  });

  describe("actions", () => {
    it("should change bucket icon", () => {
      fixture.debugElement.query(By.css("mat-toolbar button mat-menu")).nativeElement.click();
      fixture.detectChanges();
      (document.body.querySelector(".mat-menu-content button") as HTMLElement).click();
      fixture.detectChanges();
      expect(
        fixture.debugElement.query(By.css("div.right-content mat-toolbar button mat-icon"))
          .nativeElement.textContent
      ).toBe("3d_rotation");
    });

    it("should delete prop1", () => {
      fixture.componentInstance.deleteProperty("prop1");
      fixture.detectChanges();

      expect(fixture.componentInstance.bucket).toEqual({
        _id: "123",
        title: "my bucket",
        description: "description",
        primary: undefined,
        icon: "myIcon",
        required: [],
        readOnly: false,
        history: true,
        acl: {
          write: "true==true",
          read: "true==true"
        },
        properties: {
          prop2: {
            type: "textarea",
            title: "title of prop2",
            description: "description of prop2",
            options: {
              position: "right",
              visible: false,
              translate: false
            }
          }
        }
      });
    });

    it("should save bucket", async () => {
      await fixture.whenStable();
      const form = fixture.debugElement.query(By.css("form")).injector.get(NgForm);
      form.setValue({
        title: "new title",
        description: "new description",
        readOnly: false,
        history: false
      });
      fixture.detectChanges();
      await fixture.debugElement.query(By.css("mat-card-actions button")).nativeElement.click();
      expect(fixture.componentInstance["bs"].replaceOne).toHaveBeenCalledTimes(1);
      expect(fixture.componentInstance["bs"].replaceOne).toHaveBeenCalledWith({
        ...myBucket,
        title: "new title",
        description: "new description",
        readOnly: false,
        history: false,
        order: 1
      } as Bucket);
    });

    it("should clear histories of bucket", fakeAsync(() => {
      let clearHistorySpy = fixture.componentInstance["historyService"].clearHistories;
      fixture.componentInstance.clearHistories();
      expect(clearHistorySpy).toHaveBeenCalledTimes(1);
      expect(clearHistorySpy).toHaveBeenCalledWith("123");
    }));
  });

  describe("errors", () => {
    describe("form", () => {
      let form: NgForm;

      beforeEach(() => {
        form = fixture.debugElement
          .query(By.css("mat-card mat-list-item:first-of-type form"))
          .injector.get(NgForm);
      });

      it("should show fill the form correctly error", async () => {
        await fixture.whenStable();
        form.control.markAsTouched();
        form.control.setErrors({test: true});
        fixture.detectChanges();
        expect(
          fixture.debugElement.query(By.css("mat-card span:nth-child(1) mat-error")).nativeElement
            .textContent
        ).toBe(" Please correctly fill the describe form. ");
      });
    });

    describe("title", () => {
      let input: NgModel;

      beforeEach(() => {
        input = fixture.debugElement
          .query(By.css("mat-card mat-list-item:first-of-type form mat-form-field input"))
          .injector.get(NgModel);
      });

      it("should show required field error", async () => {
        await fixture.whenStable();
        input.control.reset();
        input.control.markAsTouched();
        fixture.detectChanges();
        expect(
          fixture.debugElement.query(
            By.css("mat-card mat-list-item:first-of-type form mat-form-field mat-error")
          ).nativeElement.textContent
        ).toBe("This field is required.");
      });

      it("should show minlength error", async () => {
        await fixture.whenStable();
        input.control.setValue("12");
        input.control.markAsTouched();
        fixture.detectChanges();
        expect(
          fixture.debugElement.query(
            By.css("mat-card mat-list-item:first-of-type form mat-form-field mat-error")
          ).nativeElement.textContent
        ).toBe(" Length of the name must be greater than 4 character. ");
      });

      it("should show maxlength error", async () => {
        await fixture.whenStable();
        input.control.setValue(
          "qwertyuıopğüasdfghjklqwertyuıopğüasdfghjklqwertyuıopğüasdfghjklqwertyuıopğüasdfghjklqwertyuıopğüasdfghjklqwertyuıopğüasdfghjklqwertyuıopğüasdffghjklty"
        );
        input.control.markAsTouched();
        fixture.detectChanges();
        expect(
          fixture.debugElement.query(
            By.css("mat-card mat-list-item:first-of-type form mat-form-field mat-error")
          ).nativeElement.textContent
        ).toBe(" Length of the name must be less than 100 character. ");
      });
    });

    describe("description", () => {
      let textarea: NgModel;

      beforeEach(() => {
        textarea = fixture.debugElement
          .query(
            By.css("mat-card mat-list-item:first-of-type form mat-form-field:nth-child(2) textarea")
          )
          .injector.get(NgModel);
      });

      it("should show required field error", async () => {
        await fixture.whenStable();
        textarea.reset();
        textarea.control.markAsTouched();
        fixture.detectChanges();
        expect(
          fixture.debugElement.query(
            By.css(
              "mat-card mat-list-item:first-of-type form mat-form-field:nth-child(2) mat-error"
            )
          ).nativeElement.textContent
        ).toBe("This field is required.");
      });

      it("should show minlength error", async () => {
        await fixture.whenStable();
        textarea.control.setValue("111");
        textarea.control.markAsTouched();
        fixture.detectChanges();
        expect(
          fixture.debugElement.query(
            By.css(
              "mat-card mat-list-item:first-of-type form mat-form-field:nth-child(2) mat-error"
            )
          ).nativeElement.textContent
        ).toBe(" Length of the description must be greater than 5 character. ");
      });
    });

    describe("others", () => {
      it("should show add property error", () => {
        fixture.componentInstance.bucket.properties = {};
        fixture.detectChanges();
        expect(
          fixture.debugElement.query(By.css("mat-card mat-list span.errors mat-error"))
            .nativeElement.textContent
        ).toBe(" Please add at least one property. ");
      });

      it("should show primary property error", () => {
        fixture.componentInstance.bucket.primary = undefined;
        fixture.detectChanges();
        expect(
          fixture.debugElement.query(By.css("mat-card mat-list span.errors mat-error"))
            .nativeElement.textContent
        ).toBe(" Please select a primary property. ");
      });

      it("should show visible property error", () => {
        fixture.componentInstance.bucket.properties.prop1.options.visible = false;
        fixture.componentInstance.updatePositionProperties();
        fixture.detectChanges();
        expect(
          fixture.debugElement.query(By.css("mat-card mat-list span.errors mat-error"))
            .nativeElement.textContent
        ).toBe(" You have to make at least a property visible at the list. ");
      });
    });
  });
});
