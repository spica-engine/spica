import {ComponentFixture, fakeAsync, TestBed, tick} from "@angular/core/testing";
import {FormsModule, NgModel} from "@angular/forms";
import {MatOptionModule} from "@angular/material/core";
import {MatSelectModule} from "@angular/material/select";
import {By} from "@angular/platform-browser";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {EMPTY_INPUT_SCHEMA, INPUT_SCHEMA} from "@spica-client/common";
import {of} from "rxjs";
import {BucketService} from "src/bucket/services/bucket.service";
import {RelationSchemaComponent} from "./relation-schema.component";

describe("Relation Schema Component", () => {
  describe("basic behavior", () => {
    let fixture: ComponentFixture<RelationSchemaComponent>;

    beforeEach(fakeAsync(() => {
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
              getBuckets: jasmine.createSpy("getBuckets").and.returnValues(
                of([
                  {_id: "bucket1", primary: "primary", title: "Bucket 1"},
                  {_id: "bucket2", primary: "primary", title: "Bucket 2"}
                ])
              )
            }
          }
        ],
        declarations: [RelationSchemaComponent]
      }).compileComponents();

      fixture = TestBed.createComponent(RelationSchemaComponent);
      fixture.detectChanges();

      tick(10);
      fixture.detectChanges(false);
    }));

    it("should show required bucket error", fakeAsync(() => {
      const ngModel = fixture.debugElement.query(By.directive(NgModel)).injector.get(NgModel);
      ngModel.control.setValue(undefined);
      ngModel.control.markAsTouched();
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.css("mat-error")).nativeElement.textContent).toBe(
        "You must select a bucket"
      );
    }));

    it("should show buckets", () => {
      fixture.debugElement.query(By.css("mat-form-field mat-select")).nativeElement.click();
      fixture.detectChanges();

      const options = document.body.querySelectorAll<HTMLElement>("mat-option");
      expect(options.item(0).textContent).toBe(" Bucket 1 ");
      expect(options.item(1).textContent).toBe(" Bucket 2 ");
    });

    it("should select bucket", () => {
      fixture.debugElement.query(By.css("mat-form-field mat-select")).nativeElement.click();
      fixture.detectChanges();

      document.body.querySelector<HTMLElement>("mat-option:last-of-type").click();
      fixture.detectChanges();

      expect(fixture.componentInstance.schema.bucketId).toBe("bucket2");
    });

    it("should fill with initial value", fakeAsync(() => {
      fixture.componentInstance.schema.bucketId = "bucket1";
      fixture.detectChanges();
      tick();
      fixture.detectChanges();
      expect(
        fixture.debugElement.query(By.css("mat-form-field mat-select")).nativeElement.textContent
      ).toBe("Bucket 1");
    }));
  });
});
