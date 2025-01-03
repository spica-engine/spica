import {HttpEventType, HttpParams, HttpResponse} from "@angular/common/http";
import {HttpClientTestingModule, HttpTestingController} from "@angular/common/http/testing";
import {Component, Directive, EventEmitter, Input, Output} from "@angular/core";
import {ComponentFixture, TestBed} from "@angular/core/testing";
import {MatDialogModule} from "@angular/material/dialog";
import {MatIconModule} from "@angular/material/icon";
import {MatTooltipModule} from "@angular/material/tooltip";
import {MatProgressSpinner, MatProgressSpinnerModule} from "@angular/material/progress-spinner";
import {MatProgressBarModule} from "@angular/material/progress-bar";
import {By} from "@angular/platform-browser";
import {INPUT_SCHEMA} from "@spica-client/common";
import {Filters} from "../../helpers";
import {StorageDialogOverviewDialog} from "../storage-dialog-overview/storage-dialog-overview";
import {StorageComponent} from "./storage.component";
import {Observable} from "rxjs";

@Directive({
  selector: "[storagePicker]"
})
class PickerDirective {
  @Input("storagePicker") options: any;
  @Output("ngModelChange") change = new EventEmitter();
}

@Component({
  selector: "storage-view",
  template: ""
})
class StorageViewCmp {
  @Input() blob: string | Blob | Storage;
  ready = false;
}

describe("StorageComponent", () => {
  let fixture: ComponentFixture<StorageComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        HttpClientTestingModule,
        MatProgressSpinnerModule,
        MatProgressBarModule,
        MatTooltipModule,
        MatIconModule,
        MatDialogModule
      ],
      declarations: [
        StorageComponent,
        PickerDirective,
        StorageViewCmp,
        StorageDialogOverviewDialog
      ],
      providers: [
        {
          provide: INPUT_SCHEMA,
          useValue: {
            type: "storage",
            $name: "test"
          }
        }
      ]
    });
    fixture = TestBed.createComponent(StorageComponent);
    fixture.detectChanges();
  });

  describe("basic behavior", () => {
    it("should show title", () => {
      const title = (fixture.componentInstance.schema.title = "my title");
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css("section span h5")).nativeElement.textContent).toBe(
        title
      );
    });

    it("should show description if provided", () => {
      expect(fixture.debugElement.query(By.css("section span small"))).toBeNull();
      const description = (fixture.componentInstance.schema.description = "my long description");
      fixture.detectChanges(false);
      expect(
        fixture.debugElement.query(By.css("section span small")).nativeElement.textContent
      ).toBe(description);
    });

    it("should add class when disabled", () => {
      fixture.componentInstance.setDisabledState(true);
      fixture.detectChanges();
      expect(fixture.debugElement.classes.disabled).toBe(true);
    });

    it("should not show clear button when empty", () => {
      expect(
        fixture.debugElement.query(By.css("section span:last-of-type button:last-of-type"))
      ).not.toBeTruthy();
    });

    it("should clear", () => {
      fixture.componentInstance.value = "http://example/test.png";
      fixture.componentInstance.blob = null;
      fixture.detectChanges();

      fixture.debugElement
        .query(By.css("section span:last-of-type button:last-of-type"))
        .nativeElement.click();
      expect(fixture.componentInstance.value).toBeUndefined();
      expect(fixture.componentInstance.blob).toBeUndefined();
    });
  });

  describe("preview", () => {
    it("should show drop area if empty", () => {
      fixture.componentInstance.blob = fixture.componentInstance.value = undefined;
      fixture.detectChanges();
      expect(
        fixture.debugElement.query(By.css("div.drop mat-icon")).nativeElement.textContent
      ).toBe("save_alt");
      expect(fixture.debugElement.query(By.css("div.drop small")).nativeElement.textContent).toBe(
        "Drag & Drop your file here"
      );
    });

    it("should change preview icon to drop when dragging over", () => {
      fixture.componentInstance.value = "http://example/test.png";
      fixture.componentInstance.blob = {
        name: "",
        size: 0,
        type: "image/png"
      };
      fixture.componentInstance.isDraggingOver = true;
      fixture.detectChanges(false);
      expect(
        fixture.debugElement.query(By.css("section:last-of-type mat-icon")).nativeElement
          .textContent
      ).toBe("save_alt");
    });

    it("should hide progress bar when ready", () => {
      fixture.componentInstance.progress$ = new Observable();
      fixture.componentInstance.value = "http://example/test.png";
      fixture.detectChanges(false);

      expect(fixture.debugElement.query(By.css("mat-progress-bar"))).toBeTruthy();

      //@ts-ignore
      fixture.componentInstance.progress$ = undefined;
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.css("mat-progress-bar"))).not.toBeTruthy();
    });
  });

  describe("picker", () => {
    it("should emit the changes from picker", () => {
      const ngModelChange = jasmine.createSpy("ngModelChange");
      fixture.componentInstance.registerOnChange(ngModelChange);

      fixture.debugElement
        .query(By.directive(PickerDirective))
        .injector.get(PickerDirective)
        .change.emit({
          name: "",
          url: "http://example/test.png",
          size: 0,
          type: "image/png"
        });

      expect(ngModelChange).toHaveBeenCalledTimes(1);
      expect(ngModelChange).toHaveBeenCalledWith("http://example/test.png");
    });
  });

  describe("upload", () => {
    let httpTestingController: HttpTestingController;
    const file = new File([], "test.png", {type: "image/png"});
    let findParams: HttpParams;
    let preventDefaultSpy = jasmine.createSpy();

    beforeEach(async () => {
      httpTestingController = TestBed.get(HttpTestingController);
      fixture.debugElement.triggerEventHandler("drop", {
        dataTransfer: {
          files: {
            0: file,
            item: () => file,
            length: 1
          }
        },
        preventDefault: preventDefaultSpy
      });

      fixture.detectChanges();
      await new Promise(resolve => setTimeout(resolve, 200));

      findParams = new HttpParams();
      findParams = findParams.set("limit", "1");
      findParams = findParams.set("filter", JSON.stringify(Filters.Match("root/")));
      findParams = findParams.set("paginate", "false");
    });

    afterEach(() => {
      preventDefaultSpy.calls.reset();
    });

    it("should handle drop", async () => {
      expect(preventDefaultSpy).toHaveBeenCalledTimes(1);
      httpTestingController.expectOne("api:/storage", "upload object");
    });

    /**
     * TypeError: Cannot read properties of null (reading 'componentInstance')
     */
    xit("should report upload progress and remove spinner after complete", async () => {
      httpTestingController.expectOne("api:/storage?" + findParams.toString()).flush([]);
      await new Promise(resolve => setTimeout(resolve, 200));
      fixture.detectChanges();

      const req = httpTestingController.expectOne("api:/storage");

      req.event({type: HttpEventType.UploadProgress, total: 100, loaded: 10});
      await new Promise(resolve => setTimeout(resolve, 200));
      fixture.detectChanges();

      expect(
        fixture.debugElement.query(By.directive(MatProgressSpinner)).componentInstance.value
      ).toBe(10);

      req.event(new HttpResponse({body: [{url: "http://example/0"}]}));

      expect(fixture.componentInstance.value).toBe("http://example/0");
    });
  });
});
