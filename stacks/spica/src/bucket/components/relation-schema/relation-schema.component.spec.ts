import {ComponentFixture, TestBed} from "@angular/core/testing";
import {FormsModule, NgModel} from "@angular/forms";
import {MatOptionModule, MatSelectModule} from "@angular/material";
import {By} from "@angular/platform-browser";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {EMPTY_INPUT_SCHEMA, INPUT_SCHEMA} from "@spica-server/common";
import {of} from "rxjs";
import {BucketService} from "src/bucket/services/bucket.service";
import {RelationType} from "../relation";
import {RelationSchemaComponent} from "./relation-schema.component";

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
      const relationForm = fixture.debugElement.query(By.directive(NgModel)).injector.get(NgModel);
      relationForm.control.markAsTouched();
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.css("mat-error")).nativeElement.textContent).toBe(
        "You must select a relation type"
      );
    });

    it("should show required bucket error", () => {
      const bucketForm = fixture.debugElement
        .queryAll(By.directive(NgModel))[1]
        .injector.get(NgModel);
      bucketForm.control.markAsTouched();
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.css("mat-error")).nativeElement.textContent).toBe(
        "You must select a bucket"
      );
    });

    it("should show relation types", () => {
      fixture.debugElement
        .query(By.css("mat-form-field:first-of-type mat-select"))
        .nativeElement.click();
      fixture.detectChanges();

      const options = document.body.querySelectorAll<HTMLElement>("mat-option");

      expect(Array.from(options).map(b => b.textContent)).toEqual([
        "Many to Many",
        "One to Many",
        "One to One"
      ]);

      expect(options.item(0).classList).toContain("mat-active");
      expect(options.item(1).classList).toContain("mat-option-disabled");
      expect(options.item(2).classList).toContain("mat-option-disabled");
    });

    it("should show buckets", () => {
      fixture.debugElement
        .query(By.css("mat-form-field:last-of-type mat-select"))
        .nativeElement.click();
      fixture.detectChanges();

      const options = document.body.querySelectorAll<HTMLElement>("mat-option");
      expect(options.item(0).textContent).toBe(" bucket1 ");
      expect(options.item(1).textContent).toBe(" bucket2 ");
    });

    it("should select relation", () => {
      fixture.debugElement.query(By.css("mat-select:first-of-type")).nativeElement.click();
      fixture.detectChanges();

      document.body.querySelector<HTMLElement>("mat-option:first-of-type").click();
      fixture.detectChanges();

      expect(
        fixture.debugElement.query(By.css("mat-select:first-of-type")).nativeElement.textContent
      ).toBe("Many to Many");
    });

    xit("should select bucket", () => {
      // fixture.debugElement.query(B)
      // compiled.querySelectorAll("mat-select")[1].click();
      // fixture.detectChanges();
      // compiled = document.body;
      // compiled.querySelectorAll("mat-option")[1].click();
      // fixture.detectChanges();

      // expect(fixture.debugElement.nativeElement.querySelectorAll("mat-select")[1].textContent).toBe(
      //   " bucket1 "
      // );
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
