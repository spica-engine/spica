import {RelationSchemaComponent} from "./relation-schema.component";
import {
  ComponentFixture,
  TestBed,
  tick,
  fakeAsync,
  flushMicrotasks,
  async
} from "@angular/core/testing";
import {MatFormFieldModule} from "@angular/material/form-field";
import {FormsModule, NgModel} from "@angular/forms";
import {MatOptionModule, MatSelectModule, MatOption, MatSelect} from "@angular/material";
import {INPUT_SCHEMA, EMPTY_INPUT_SCHEMA} from "@spica-server/common";
import {RelationSchema, RelationType} from "../relation";
import {BucketService} from "src/bucket/services/bucket.service";
import {of} from "rxjs";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {Element} from "@angular/compiler/src/render3/r3_ast";
import {By} from "@angular/platform-browser";

fdescribe("Relation Schema Component", () => {
  describe("basic behavior", () => {
    let component: RelationSchemaComponent;
    let fixture: ComponentFixture<RelationSchemaComponent>;
    let compiled;

    beforeEach(() => {
      TestBed.configureTestingModule({
        imports: [FormsModule, MatOptionModule, MatSelectModule, NoopAnimationsModule],
        providers: [
          {
            provide: INPUT_SCHEMA,
            useValue: EMPTY_INPUT_SCHEMA
          },
          {
            provide: BucketService,
            useValue: {
              getBuckets: jasmine
                .createSpy("getBuckets")
                .and.returnValues(
                  of([
                    {primary: "primary", title: "bucket1"},
                    {primary: "primary", title: "bucket2"}
                  ])
                )
            }
          }
        ],
        declarations: [RelationSchemaComponent]
      }).compileComponents();

      fixture = TestBed.createComponent(RelationSchemaComponent);
      component = fixture.componentInstance;
      compiled = fixture.debugElement.nativeElement;
      fixture.detectChanges();
    });

    it("should show required relation type error", () => {
      const relationForm = fixture.debugElement
        .queryAll(By.directive(NgModel))[0]
        .injector.get(NgModel);
      relationForm.control.markAsTouched();
      fixture.detectChanges();

      expect(document.body.querySelector("mat-error").textContent).toBe(
        "You must select a relation type"
      );
    });

    it("should show required bucket error", () => {
      const bucketForm = fixture.debugElement
        .queryAll(By.directive(NgModel))[1]
        .injector.get(NgModel);
      bucketForm.control.markAsTouched();
      fixture.detectChanges();

      expect(document.body.querySelector("mat-error").textContent).toBe("You must select a bucket");
    });

    it("should show relation types", () => {
      compiled.querySelector("mat-select:first-of-type").click();
      fixture.detectChanges();

      compiled = document.body;

      const options = compiled.querySelectorAll("mat-option");

      expect(Array.from(options).map((b: any) => b.textContent)).toEqual(
        ["Many to Many", "One to Many", "One to One"],
        "should work if relation type options texts' rendered correctly "
      );

      expect(Array.from(options).map((b: any) => b.getAttribute("class"))).toEqual(
        [
          "mat-option mat-active",
          "mat-option mat-option-disabled",
          "mat-option mat-option-disabled"
        ],
        "should work if relation type options classes' rendered correctly "
      );
    });

    it("should show buckets", () => {
      compiled.querySelectorAll("mat-select")[1].click();
      fixture.detectChanges();

      compiled = document.body;

      expect(
        Array.from(compiled.querySelectorAll("mat-option")).map((b: any) => b.textContent)
      ).toEqual(
        [" bucket1 ", " bucket2 "],
        "should work if defined bucket titles rendered correctly "
      );
    });

    it("should select relation", () => {
      compiled.querySelector("mat-select:first-of-type").click();
      fixture.detectChanges();
      compiled = document.body;
      compiled.querySelector("mat-option:first-of-type").click();
      fixture.detectChanges();
      expect(
        fixture.debugElement.nativeElement.querySelector("mat-select:first-of-type").textContent
      ).toBe("Many to Many");
    });

    xit("should select bucket", () => {
      compiled.querySelectorAll("mat-select")[1].click();
      fixture.detectChanges();
      compiled = document.body;
      compiled.querySelectorAll("mat-option")[1].click();
      fixture.detectChanges();

      expect(fixture.debugElement.nativeElement.querySelectorAll("mat-select")[1].textContent).toBe(
        " bucket1 "
      );
    });
  });

  describe("should work with relation schema", () => {
    let component: RelationSchemaComponent;
    let fixture: ComponentFixture<RelationSchemaComponent>;
    let compiled;
    let relationSchema = {
      bucket: "test",
      relationType: RelationType.OneToMany
    };

    beforeEach(() => {
      TestBed.configureTestingModule({
        imports: [FormsModule, MatOptionModule, MatSelectModule, NoopAnimationsModule],
        providers: [
          {
            provide: INPUT_SCHEMA,
            useValue: relationSchema
          },
          {
            provide: BucketService,
            useValue: {
              getBuckets: jasmine
                .createSpy("getBuckets")
                .and.returnValues(
                  of([
                    {primary: "primary", title: "bucket1"},
                    {primary: "primary", title: "bucket2"}
                  ])
                )
            }
          }
        ],
        declarations: [RelationSchemaComponent]
      }).compileComponents();

      fixture = TestBed.createComponent(RelationSchemaComponent);
      component = fixture.componentInstance;
      compiled = fixture.debugElement.nativeElement;
      fixture.detectChanges();
    });

    xit("should show relations", () => {
      console.log(
        compiled.querySelector("mat-select:first-of-type").getAttribute("ng-reflect-model")
      );
    });
  });
});
