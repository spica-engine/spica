import {TestBed, ComponentFixture, tick, fakeAsync} from "@angular/core/testing";
import {MatCardModule} from "@angular/material/card";
import {MatCheckboxModule} from "@angular/material/checkbox";
import {MatOptionModule} from "@angular/material/core";
import {MatDividerModule} from "@angular/material/divider";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatIconModule} from "@angular/material/icon";
import {MatInputModule} from "@angular/material/input";
import {MatListModule} from "@angular/material/list";
import {MatMenuModule, _MatMenuDirectivesModule} from "@angular/material/menu";
import {MatPaginatorModule} from "@angular/material/paginator";
import {MatSelectModule} from "@angular/material/select";
import {MatSlideToggleModule} from "@angular/material/slide-toggle";
import {MatToolbarModule} from "@angular/material/toolbar";
import {MatTooltipModule} from "@angular/material/tooltip";
import {PropertyKvPipe} from "@spica-client/common/pipes";
import {InputModule} from "@spica-client/common";
import {MatSaveModule} from "@spica-client/material";
import {MatButtonModule} from "@angular/material/button";

import {BucketService} from "src/bucket/services/bucket.service";
import {AddFieldModalComponent} from "./add-field-modal.component";

import {of} from "rxjs";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {By} from "@angular/platform-browser";
import {MatDialogModule, MatDialogRef, MAT_DIALOG_DATA} from "@angular/material/dialog";
import {FormsModule} from "@angular/forms";
import {CanInteractDirectiveTest} from "@spica-client/passport/directives/can-interact.directive";

describe("Add Field Component", () => {
  let fixture: ComponentFixture<AddFieldModalComponent>;
  let sampleSchema = {
    _id: "123",
    title: "my bucket",
    description: "description",
    primary: "prop1",
    icon: "myIcon",
    required: [],
    readOnly: false,
    history: true,
    properties: {
      prop1: {
        type: "string",
        title: "title of prop1",
        description: "description of prop1",
        options: {
          position: "left",
          translate: true
        }
      },
      prop2: {
        type: "textarea",
        title: "title of prop2",
        description: "description of prop2",
        options: {
          position: "right",
          translate: false
        }
      },
      prop3: {
        type: "date",
        title: "title of prop3",
        description: "description of prop3",
        options: {
          position: "right"
        }
      }
    }
  };
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        MatCardModule,
        MatSelectModule,
        MatOptionModule,
        MatButtonModule,
        MatCheckboxModule,
        MatIconModule,
        MatSlideToggleModule,
        MatListModule,
        MatDividerModule,
        FormsModule,
        MatFormFieldModule,
        MatInputModule,
        _MatMenuDirectivesModule,
        MatMenuModule,
        MatTooltipModule,
        MatDialogModule,
        MatPaginatorModule,
        MatToolbarModule,
        NoopAnimationsModule,
        InputModule.withPlacers([]),
        MatSaveModule
      ],
      providers: [
        {
          provide: BucketService,
          useValue: {
            getPredefinedDefaults: jasmine
              .createSpy("getPredefinedDefaults")
              .and.returnValues(
                of([{keyword: "keyword", type: "type"}, {keyword: "keyword2", type: "date"}])
              )
          }
        },
        {
          provide: MatDialogRef,
          useValue: {}
        },
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            parentSchema: sampleSchema,
            propertyKey: "prop1"
          }
        }
      ],
      declarations: [AddFieldModalComponent, PropertyKvPipe, CanInteractDirectiveTest]
    }).compileComponents();

    fixture = TestBed.createComponent(AddFieldModalComponent);
    fixture.detectChanges();
  });

  describe("basic behaviours", () => {
    it("should open field selection", () => {
      fixture.componentInstance.step = 0;
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css(".field"))).toBeTruthy();
    });

    it("should open field name setting while adding new property", () => {
      fixture.componentInstance.step = 1;
      fixture.componentInstance.propertyKey = undefined;
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css(".field-name-settings"))).toBeTruthy();
    });

    it("should open field configuration", () => {
      fixture.componentInstance.step = 1;
      fixture.componentInstance.propertyKey = "prop1";
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css(".field-configuration"))).toBeTruthy();
    });

    it("should hide advanced settings if the field is object", () => {
      fixture.componentInstance.step = 1;
      fixture.componentInstance.field = "object";
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css(".input-placer-area"))).toBeFalsy();

      fixture.componentInstance.field = "string";
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css(".input-placer-area"))).toBeTruthy();
    });

    it("should open default value selection if the field is date", () => {
      fixture.componentInstance.step = 1;
      fixture.componentInstance.propertyKv =
        fixture.componentInstance.parentSchema.properties["prop3"];
      fixture.componentInstance.fieldConfig = {
        origin: "string",
        type: "date",
        placer: {},
        color: "#fff",
        icon: "sample_icon"
      };
      fixture.componentInstance.field = "date";
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css(".input-defaults mat-select"))).toBeTruthy();
    });

    it("should disable action button if name is empty", () => {
      fixture.componentInstance.propertyKey = undefined;
      fixture.componentInstance.chooseFieldType("date");
      expect(fixture.componentInstance.field).toBe("date");
      expect(fixture.componentInstance.step).toBe(1);
      fixture.detectChanges();
      expect(
        fixture.debugElement.query(By.css(".field-name-settings button[disabled]"))
      ).toBeTruthy();
    });

    it("should hide general settings if parent schema is not the bucket", () => {
      delete fixture.componentInstance.parentSchema.primary;
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css(".general-settings"))).toBeFalsy();

      fixture.componentInstance.parentSchema.primary = "prop1";
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css(".general-settings"))).toBeTruthy();
    });
  });

  describe("actions", () => {
    it("should continue to life cycle", () => {
      fixture.componentInstance.propertyKey = undefined;
      fixture.componentInstance.chooseFieldType("date");
      expect(fixture.componentInstance.field).toBe("date");
      expect(fixture.componentInstance.step).toBe(1);
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css(".field-name-settings"))).toBeTruthy();
    });

    it("should update required fields", () => {
      fixture.componentInstance.toggleRequired("prop1", true);
      expect(fixture.componentInstance.parentSchema.required).toEqual(["prop1"]);
      fixture.componentInstance.toggleRequired("prop1", false);
      expect(fixture.componentInstance.parentSchema.required).toEqual([]);
    });
  });
});
