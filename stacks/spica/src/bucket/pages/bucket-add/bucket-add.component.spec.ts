import {TestBed, ComponentFixture, tick, fakeAsync} from "@angular/core/testing";
import {BucketAddComponent} from "./bucket-add.component";
import {
  MatMenuTrigger,
  MatIconModule,
  MatMenuModule,
  _MatMenuDirectivesModule,
  MatTooltipModule,
  MatPaginatorModule,
  MatToolbarModule,
  MatError,
  MatFormFieldModule,
  MatDividerModule,
  MatSlideToggleModule,
  MatListModule,
  MatExpansionModule,
  MatCheckboxModule,
  MatOption,
  MatOptionModule,
  MatSelectModule,
  MatGridListModule,
  MatCardModule,
  MatProgressSpinnerModule,
  MatInputModule,
  MatCheckbox
} from "@angular/material";
import {FormsModule, NgModel, NgControl, NgForm} from "@angular/forms";
import {CdkDropList, DragDropModule} from "@angular/cdk/drag-drop";
import {PropertyKvPipe} from "../../../../packages/common/property_keyvalue.pipe";
import {InputSchemaPlacer, InputResolver, InputModule} from "@spica-server/common";
import {ActivatedRoute, Router} from "@angular/router";
import {BucketService} from "src/bucket/services/bucket.service";
import {of, empty} from "rxjs";
import {emptyBucket, Bucket} from "src/bucket/interfaces/bucket";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {By} from "@angular/platform-browser";
import {async} from "q";
import {DebugElement} from "@angular/core";

//test for undefined params id

fdescribe("Bucket Add Component", () => {
  let fixture: ComponentFixture<BucketAddComponent>;

  let myBucket = {
    _id: "123",
    title: "my bucket",
    description: "description",
    primary: "prop1",
    icon: "myIcon",
    readOnly: false,
    properties: {
      prop1: {
        type: "string",
        title: "title of prop1",
        description: "description of prop1",
        options: {
          position: "left",
          visible: true
        }
      },
      prop2: {
        type: "textarea",
        title: "title of prop2",
        description: "description of prop2",
        options: {
          position: "right"
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
            options: {position: "left", visible: true}
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
              position: "right"
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
        visible: true
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
        position: "right"
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
          options: {position: "left", visible: true}
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
            position: "right"
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
      fixture.debugElement.query(By.css("mat-card mat-card-actions button mat-icon")).nativeElement
    ).toBeDefined("should work if savingstate is false as default");
  });

  it("should show settings of prop1", () => {
    fixture.debugElement
      .query(By.css("mat-list-item.properties mat-expansion-panel:nth-child(1) mat-menu"))
      .nativeElement.click();
    fixture.detectChanges();

    expect(
      document.body.querySelector(
        "div.mat-menu-content div.mat-menu-item:nth-child(1) mat-checkbox"
      ).classList
    ).toContain("mat-checkbox-checked", "should be checked if this option is primary");

    expect(
      document.body.querySelector(
        "div.mat-menu-content div.mat-menu-item:nth-child(1) mat-checkbox"
      ).classList
    ).toContain("mat-checkbox-disabled", "should be disabled if this option primary");

    // get ngmodel of dom element
    // console.log(
    //   document.body.querySelector(
    //     "div.mat-menu-content div.mat-menu-item:nth-child(2) mat-checkbox"
    //   )
    // );
    // console.log(
    //   document.body.querySelector(
    //     "div.mat-menu-content div.mat-menu-item:nth-child(4) mat-checkbox"
    //   ).classList
    // );
    // console.log(
    //   document.body.querySelector(
    //     "div.mat-menu-content div.mat-menu-item:nth-child(5) mat-checkbox"
    //   ).classList
    // );

    expect(
      document.body.querySelector(
        "div.mat-menu-content div.mat-menu-item:nth-child(3) mat-checkbox"
      ).classList
    ).toContain(
      "mat-checkbox-disabled",
      "should be disable if this option doesn't contain translatable value"
    );
  });

  it("should change bucket icon", () => {
    fixture.debugElement.query(By.css("mat-toolbar button mat-menu")).nativeElement.click();
    fixture.detectChanges();
    (document.body.querySelector(".mat-menu-content button") as HTMLElement).click();
    fixture.detectChanges();
    expect(
      fixture.debugElement.query(By.css("mat-toolbar button mat-icon")).nativeElement.textContent
    ).toBe("3d_rotation");
  });

  fdescribe("errors", () => {
    describe("form", () => {
      let form: NgForm;

      beforeEach(() => {
        form = fixture.debugElement
          .query(By.css("mat-card mat-list-item:first-of-type form"))
          .injector.get(NgForm);
      });

      //last
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

      //250 character maxlength test?
    });

    fdescribe("property", () => {
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

      fit("should show already exist error", async () => {
        await fixture.whenStable();
        input.control.setValue("prop2");
        input.control.markAsTouched();
        fixture.detectChanges();
        expect(
          fixture.debugElement.query(
            By.css("mat-card mat-list-item.property mat-form-field mat-error")
          ).nativeElement.textContent
        ).toBe(" prop2 is already exists. ");
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
