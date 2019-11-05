import {TestBed, ComponentFixture, tick, fakeAsync} from "@angular/core/testing";
import {BucketAddComponent} from "./bucket-add.component";
import {
  MatIconModule,
  MatMenuModule,
  _MatMenuDirectivesModule,
  MatTooltipModule,
  MatPaginatorModule,
  MatToolbarModule,
  MatFormFieldModule,
  MatDividerModule,
  MatSlideToggleModule,
  MatListModule,
  MatExpansionModule,
  MatCheckboxModule,
  MatOptionModule,
  MatSelectModule,
  MatGridListModule,
  MatCardModule,
  MatProgressSpinnerModule,
  MatInputModule
} from "@angular/material";
import {FormsModule, NgModel, NgForm} from "@angular/forms";
import {CdkDropList, DragDropModule} from "@angular/cdk/drag-drop";
import {PropertyKvPipe} from "../../../../packages/common/property_keyvalue.pipe";
import {InputModule} from "@spica-server/common";
import {ActivatedRoute, Router} from "@angular/router";
import {BucketService} from "src/bucket/services/bucket.service";
import {of} from "rxjs";
import {Bucket} from "src/bucket/interfaces/bucket";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {By} from "@angular/platform-browser";

describe("Bucket Add Component", () => {
  let fixture: ComponentFixture<BucketAddComponent>;

  let myBucket = {
    _id: "123",
    title: "my bucket",
    description: "description",
    primary: "prop1",
    icon: "myIcon",
    required: ["prop1"],
    readOnly: false,
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
        MatCardModule,
        MatGridListModule,
        MatSelectModule,
        MatOptionModule,
        MatCheckboxModule,
        MatExpansionModule,
        MatIconModule,
        FormsModule,
        MatSlideToggleModule,
        MatListModule,
        MatDividerModule,
        MatFormFieldModule,
        MatInputModule,
        _MatMenuDirectivesModule,
        MatMenuModule,
        MatTooltipModule,
        MatPaginatorModule,
        MatToolbarModule,
        NoopAnimationsModule,
        InputModule.withPlacers([])
      ],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            params: of({
              id: "id1"
            })
          }
        },
        {
          provide: Router,
          useValue: {
            navigate: jasmine.createSpy("navigate")
          }
        },
        {
          provide: BucketService,
          useValue: {
            getPredefinedDefaults: jasmine
              .createSpy("getPredefinedDefaults")
              .and.returnValues(
                of([{keyword: "keyword", type: "type"}, {keyword: "keyword2", type: "type2"}])
              ),
            getBucket: jasmine.createSpy("getBucket").and.returnValue(of(myBucket)),
            replaceOne: jasmine.createSpy("replaceOne").and.returnValue(of(myBucket))
          }
        }
      ],
      declarations: [BucketAddComponent, PropertyKvPipe]
    }).compileComponents();

    fixture = TestBed.createComponent(BucketAddComponent);
    fixture.detectChanges();
  });

  describe("basic behaviours", () => {
    it("should be defined when component created", () => {
      expect(fixture.componentInstance.predefinedDefaults).toEqual({
        type: [
          {
            keyword: "keyword",
            type: "type"
          }
        ],
        type2: [
          {
            keyword: "keyword2",
            type: "type2"
          }
        ]
      });
      expect(fixture.componentInstance.bucket).toEqual(myBucket as Bucket);
      expect(fixture.componentInstance.immutableProperties).toEqual(["prop1", "prop2"]);
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
        fixture.debugElement.query(By.css("h4 > button > mat-icon")).nativeElement.textContent
      ).toBe("myIcon");
      expect(fixture.debugElement.query(By.css("h4 > span")).nativeElement.textContent).toBe(
        "my bucket"
      );

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

      expect(form.query(By.css("mat-slide-toggle")).injector.get(NgModel).model).toBe(
        false,
        "should work if readonly value is false"
      );

      const firstProperty = fixture.debugElement.query(
        By.css("mat-list-item.properties mat-expansion-panel:nth-child(1)")
      );

      expect(
        firstProperty.query(By.css("mat-panel-title > mat-icon")).nativeElement.textContent
      ).toBe("format_quote");
      expect(
        firstProperty.query(By.css("mat-panel-title > mat-label")).nativeElement.textContent
      ).toBe("title of prop1");

      expect(
        firstProperty.query(By.css("span.input-placer-area")).injector.get(NgModel).model
      ).toEqual({
        type: "string",
        title: "title of prop1",
        description: "description of prop1",
        options: {
          position: "left",
          visible: true,
          translate: true
        }
      });

      const secondProperty = fixture.debugElement.query(
        By.css("mat-list-item.properties mat-expansion-panel:nth-child(2)")
      );

      expect(
        secondProperty.query(By.css("mat-panel-title > mat-icon")).nativeElement.textContent
      ).toBe("format_size");
      expect(
        secondProperty.query(By.css("mat-panel-title > mat-label")).nativeElement.textContent
      ).toBe("title of prop2");

      expect(
        secondProperty.query(By.css("span.input-placer-area")).injector.get(NgModel).model
      ).toEqual({
        type: "textarea",
        title: "title of prop2",
        description: "description of prop2",
        options: {
          position: "right",
          visible: false,
          translate: false
        }
      });

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
  });

  describe("actions", () => {
    it("should change bucket icon", () => {
      fixture.debugElement.query(By.css("mat-toolbar button mat-menu")).nativeElement.click();
      fixture.detectChanges();
      (document.body.querySelector(".mat-menu-content button") as HTMLElement).click();
      fixture.detectChanges();
      expect(
        fixture.debugElement.query(By.css("mat-toolbar button mat-icon")).nativeElement.textContent
      ).toBe("3d_rotation");
    });

    it("should show settings of prop1", fakeAsync(() => {
      fixture.debugElement
        .query(By.css("mat-list-item.properties mat-expansion-panel:nth-child(1) mat-menu"))
        .nativeElement.click();
      fixture.detectChanges();

      tick();
      fixture.detectChanges();

      expect(
        document.body.querySelector(
          "div.mat-menu-content div.mat-menu-item:nth-child(1) mat-checkbox"
        ).classList
      ).toContain("mat-checkbox-checked", "should be checked if this property is primary");

      expect(
        document.body.querySelector(
          "div.mat-menu-content div.mat-menu-item:nth-child(1) mat-checkbox"
        ).classList
      ).toContain("mat-checkbox-disabled", "should be disabled if this property is primary");

      expect(
        document.body.querySelector(
          "div.mat-menu-content div.mat-menu-item:nth-child(2) mat-checkbox"
        ).classList
      ).toContain("mat-checkbox-checked", "should be checked if this property is visible");

      expect(
        document.body.querySelector(
          "div.mat-menu-content div.mat-menu-item:nth-child(3) mat-checkbox"
        ).classList
      ).toContain("mat-checkbox-checked", "should be checked if this property is translatable");

      expect(
        document.body.querySelector(
          "div.mat-menu-content div.mat-menu-item:nth-child(3) mat-checkbox"
        ).classList
      ).toContain("mat-checkbox-disabled", "should be disabled if this property is immutablle");

      expect(
        document.body.querySelector(
          "div.mat-menu-content div.mat-menu-item:nth-child(4) mat-checkbox"
        ).classList
      ).not.toContain(
        "mat-checkbox-checked",
        "should be unchecked if this property isn't read-only"
      );

      expect(
        document.body.querySelector(
          "div.mat-menu-content div.mat-menu-item:nth-child(5) mat-checkbox"
        ).classList
      ).toContain("mat-checkbox-checked", "should be checked if this property is required");
    }));

    it("should make prop2 is primary", () => {
      fixture.debugElement
        .query(By.css("mat-list-item.properties mat-expansion-panel:nth-child(2) mat-menu"))
        .nativeElement.click();
      fixture.detectChanges();
      document.body
        .querySelector<HTMLInputElement>(
          "div.mat-menu-content div.mat-menu-item:nth-child(1) mat-checkbox input"
        )
        .dispatchEvent(new Event("click"));
      fixture.detectChanges();
      expect(fixture.componentInstance.bucket.primary).toBe("prop2");
    });

    it("should make prop2 is visible", () => {
      const spy = spyOn(fixture.componentInstance, "updatePositionProperties");
      fixture.debugElement
        .query(By.css("mat-list-item.properties mat-expansion-panel:nth-child(2) mat-menu"))
        .nativeElement.click();
      fixture.detectChanges();
      document.body
        .querySelector<HTMLInputElement>(
          "div.mat-menu-content div.mat-menu-item:nth-child(2) mat-checkbox input"
        )
        .dispatchEvent(new Event("click"));
      fixture.detectChanges();
      expect(spy).toHaveBeenCalledTimes(1);
      expect(fixture.componentInstance.bucket.properties.prop2.options.visible).toBe(true);
    });

    it("should make prop2 is required", () => {
      fixture.debugElement
        .query(By.css("mat-list-item.properties mat-expansion-panel:nth-child(2) mat-menu"))
        .nativeElement.click();
      fixture.detectChanges();
      document.body
        .querySelector<HTMLInputElement>(
          "div.mat-menu-content div.mat-menu-item:nth-child(5) mat-checkbox input"
        )
        .dispatchEvent(new Event("click"));
      fixture.detectChanges();
      expect(fixture.componentInstance.bucket.required.includes("prop2")).toBe(true);
    });

    it("should delete prop1", () => {
      fixture.debugElement
        .query(
          By.css(
            "mat-list-item.properties mat-expansion-panel:nth-child(1) mat-panel-description button:nth-child(2)"
          )
        )
        .nativeElement.click();
      fixture.detectChanges();
      expect(fixture.componentInstance.bucket.properties).toEqual({
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
      });
      expect(fixture.componentInstance.bucket.primary).toBe(undefined);
      expect(fixture.componentInstance.bucket.required).toEqual([]);
    });

    it("should add new property", async () => {
      await fixture.whenStable();
      const input = fixture.debugElement
        .query(By.css("mat-list-item.property mat-form-field input"))
        .injector.get(NgModel);
      input.control.setValue("prop3");
      input.control.markAsTouched();
      fixture.detectChanges();
      expect(
        fixture.debugElement.query(By.css("mat-list-item.property button")).nativeElement.disabled
      ).toBe(false);
      fixture.debugElement.query(By.css("mat-list-item.property button")).nativeElement.click();
      fixture.detectChanges();
      expect(fixture.componentInstance.bucket.properties["prop3"]).toEqual({
        type: "string",
        title: "prop3",
        description: "Description of prop3",
        options: {
          position: "bottom"
        }
      });
      expect(fixture.componentInstance.propertyPositionMap.bottom).toEqual([
        {
          key: "prop3",
          value: {
            type: "string",
            description: "Description of prop3",
            title: "prop3",
            options: {
              position: "bottom"
            }
          }
        }
      ]);
    });

    it("should save bucket", async () => {
      expect(fixture.componentInstance.savingBucketState).toBe(false);
      await fixture.whenStable();
      const form = fixture.debugElement.query(By.css("form")).injector.get(NgForm);
      form.setValue({
        title: "new title",
        description: "new description",
        readOnly: false
      });
      fixture.detectChanges();
      await fixture.debugElement.query(By.css("mat-card-actions button")).nativeElement.click();
      expect(fixture.componentInstance["bs"].replaceOne).toHaveBeenCalledTimes(1);
      expect(fixture.componentInstance["bs"].replaceOne).toHaveBeenCalledWith({
        ...myBucket,
        title: "new title",
        description: "new description",
        readOnly: false
      } as Bucket);
      expect(fixture.componentInstance.savingBucketState).toBe(false);
      expect(fixture.componentInstance["router"].navigate).toHaveBeenCalledTimes(1);
      expect(fixture.componentInstance["router"].navigate).toHaveBeenCalledWith(["buckets/123"]);
    });
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
        input.control.setValue("qwertyuıopğüasdfghjkl");
        input.control.markAsTouched();
        fixture.detectChanges();
        expect(
          fixture.debugElement.query(
            By.css("mat-card mat-list-item:first-of-type form mat-form-field mat-error")
          ).nativeElement.textContent
        ).toBe(" Length of the name must be less than 15 character. ");
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

    describe("property", () => {
      let input: NgModel;
      beforeEach(() => {
        input = fixture.debugElement
          .query(By.css("mat-card mat-list-item.property mat-form-field input"))
          .injector.get(NgModel);
      });
      it("should show required field error", async () => {
        await fixture.whenStable();
        input.control.reset();
        input.control.markAsTouched();
        fixture.detectChanges();
        expect(
          fixture.debugElement.query(
            By.css("mat-card mat-list-item.property mat-form-field mat-error")
          ).nativeElement.textContent
        ).toBe(" Property name is required. ");
      });

      it("should show minlength error", async () => {
        await fixture.whenStable();
        input.control.setValue("1");
        input.control.markAsTouched();
        fixture.detectChanges();
        expect(
          fixture.debugElement.query(
            By.css("mat-card mat-list-item.property mat-form-field mat-error")
          ).nativeElement.textContent
        ).toBe(" Length of the property name must be greater than 3 character. ");
      });
    });

    describe("others", () => {
      it("should show add property error", () => {
        fixture.componentInstance.bucket.properties = {};
        fixture.detectChanges();
        expect(
          fixture.debugElement.query(By.css("mat-card mat-list span:nth-child(2) mat-error"))
            .nativeElement.textContent
        ).toBe(" Please add at least one property. ");
      });

      it("should show primary property error", () => {
        fixture.componentInstance.bucket.primary = undefined;
        fixture.detectChanges();
        expect(
          fixture.debugElement.query(By.css("mat-card mat-list span:nth-child(2) mat-error"))
            .nativeElement.textContent
        ).toBe(" Please select a primary property. ");
      });

      it("should show visible property error", () => {
        fixture.componentInstance.bucket.properties.prop1.options.visible = false;
        fixture.componentInstance.updatePositionProperties();
        fixture.detectChanges();
        expect(
          fixture.debugElement.query(By.css("mat-card mat-list span:nth-child(2) mat-error"))
            .nativeElement.textContent
        ).toBe(" You have to make at least a property visible at the list. ");
      });
    });
  });
});
