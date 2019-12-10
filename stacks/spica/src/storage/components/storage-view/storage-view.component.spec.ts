import {HttpResponse} from "@angular/common/http";
import {HttpClientTestingModule, HttpTestingController} from "@angular/common/http/testing";
import {Component, DebugElement} from "@angular/core";
import {ComponentFixture, TestBed} from "@angular/core/testing";
import {MatIconModule} from "@angular/material";
import {By} from "@angular/platform-browser";
import {empty, of} from "rxjs";
import {StorageViewComponent} from "./storage-view.component";

@Component({
  template: `
    <storage-view [blob]="blob"></storage-view>
  `
})
class TestCmp {
  blob: any;
}

function base64toBlob(data: string, type: string) {
  const encodedString = atob(data);
  const arrayBuffer = new ArrayBuffer(encodedString.length);
  const uintArray = new Uint8Array(arrayBuffer);

  for (let i = 0; i < encodedString.length; i++) {
    uintArray[i] = encodedString.charCodeAt(i);
  }
  return new Blob([arrayBuffer], {type});
}

describe("StorageViewComponent", () => {
  let fixture: ComponentFixture<TestCmp>;
  let viewComponent: Omit<DebugElement, "componentInstance"> & {
    componentInstance: StorageViewComponent;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, MatIconModule],
      declarations: [StorageViewComponent, TestCmp]
    });

    fixture = TestBed.createComponent(TestCmp);

    viewComponent = fixture.debugElement.query(By.directive(StorageViewComponent));
  });

  describe("with url", () => {
    let httpTestingController: HttpTestingController;
    let observeSpy: jasmine.Spy<any>;

    beforeEach(() => {
      httpTestingController = TestBed.get(HttpTestingController);
      observeSpy = spyOn(
        fixture.debugElement.query(By.directive(StorageViewComponent)).componentInstance,
        "observe"
      ).and.returnValue(of(true));
    });

    it("should handle loading errors from http", () => {
      fixture.componentInstance.blob = "http://example/test.png";
      fixture.detectChanges();

      const req = httpTestingController.expectOne("http://example/test.png");
      req.error(new ErrorEvent("Network error"));
      fixture.detectChanges();

      expect(viewComponent.query(By.css("div mat-icon")).nativeElement.textContent).toBe("error");
      expect(viewComponent.query(By.css("div h3")).nativeElement.textContent).toBe(
        "Could not load the object."
      );
      expect(viewComponent.query(By.css("div small")).nativeElement.textContent).toBe(
        "Network error"
      );

      fixture.componentInstance.blob = "http://example/test1.png";
    });

    it("should reset previous error state", () => {
      fixture.componentInstance.blob = "http://example/test.png";
      fixture.detectChanges();

      const req = httpTestingController.expectOne("http://example/test.png");
      req.error(new ErrorEvent("Network error"));
      expect(viewComponent.componentInstance.error).toBeTruthy();

      fixture.componentInstance.blob = "http://example/test1.png";
      fixture.detectChanges();
      expect(viewComponent.componentInstance.error).not.toBeTruthy();
    });

    it("should not defer loading", () => {
      fixture.componentInstance.blob = "http://example/test.png";
      fixture.detectChanges();

      expect(observeSpy).toHaveBeenCalledTimes(1);
      httpTestingController.expectOne("http://example/test.png");
    });

    it("should defer loading", () => {
      observeSpy.and.returnValue(empty());
      fixture.componentInstance.blob = "http://example/test.png";
      fixture.detectChanges();

      expect(observeSpy).toHaveBeenCalledTimes(1);
      httpTestingController.verify();
    });

    it("should show images", done => {
      fixture.componentInstance.blob = "http://example/test.png";
      fixture.detectChanges();

      expect(viewComponent.componentInstance.ready).toBe(false);

      const req = httpTestingController.expectOne("http://example/test.png");
      req.flush(
        base64toBlob(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
          "image/png"
        )
      );
      fixture.detectChanges();

      expect(viewComponent.componentInstance.ready).toBe(false);
      expect(viewComponent.componentInstance.contentType).toBe("image/png");
      expect(viewComponent.query(By.css("img")).nativeElement.src).toBeTruthy();

      setTimeout(() => {
        expect(viewComponent.componentInstance.ready).toBe(true);
        done();
      }, 10);
    });

    xit("should show videos", () => {
      fixture.componentInstance.blob = "http://example/test.mp4";
      fixture.detectChanges();

      expect(viewComponent.componentInstance.ready).toBe(false);

      const req = httpTestingController.expectOne("http://example/test.mp4");
      req.event(
        new HttpResponse({
          body: new Blob([], {type: "video/mp4"}),
          status: 200,
          statusText: "OK"
        })
      );
      fixture.detectChanges();

      expect(viewComponent.componentInstance.contentType).toBe("video/mp4");
      expect(viewComponent.query(By.css("video source")).nativeElement.src).toBeTruthy();
      expect(viewComponent.componentInstance.ready).toBe(true);
    });

    it("should not show other types", () => {
      fixture.componentInstance.blob = "http://example/test.json";
      fixture.detectChanges();
      expect(viewComponent.componentInstance.ready).toBe(false);

      const req = httpTestingController.expectOne("http://example/test.json");
      req.event(
        new HttpResponse({
          body: new Blob([], {type: "application/json"}),
          status: 200,
          statusText: "OK"
        })
      );
      fixture.detectChanges();

      expect(viewComponent.componentInstance.contentType).toBe("application/json");
      expect(viewComponent.componentInstance.ready).toBe(true);

      expect(viewComponent.query(By.css("mat-icon")).nativeElement.textContent).toBe("warning");
      expect(viewComponent.query(By.css("h3")).nativeElement.textContent).toBe(
        "This object cannot be viewed."
      );
    });
  });

  describe("with blob", () => {
    it("should show images", done => {
      expect(viewComponent.componentInstance.ready).toBe(false);

      fixture.componentInstance.blob = base64toBlob(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "image/png"
      );
      fixture.detectChanges();

      expect(viewComponent.componentInstance.ready).toBe(false);
      expect(viewComponent.componentInstance.contentType).toBe("image/png");
      setTimeout(() => {
        expect(viewComponent.componentInstance.ready).toBe(true);
        done();
      }, 10);
    });

    xit("should show videos", () => {
      fixture.componentInstance.blob = new Blob(["1"], {type: "video/mp4"});
      fixture.detectChanges();

      expect(viewComponent.componentInstance.contentType).toBe("video/mp4");
      expect(viewComponent.componentInstance.ready).toBe(false);
    });

    it("should not show other types", () => {
      fixture.componentInstance.blob = new Blob([], {type: "application/json"});
      fixture.detectChanges();

      expect(viewComponent.componentInstance.contentType).toBe("application/json");
      expect(viewComponent.componentInstance.ready).toBe(true);
    });
  });

  describe("with storage object", () => {
    it("should show images", () => {
      fixture.componentInstance.blob = {
        url: "http://example/test.png",
        content: {
          type: "image/png"
        }
      };
      fixture.detectChanges();

      expect(viewComponent.componentInstance.contentType).toBe("image/png");
      expect(viewComponent.componentInstance.ready).toBe(false);
    });

    xit("should show videos", () => {
      fixture.componentInstance.blob = {
        url: "http://example/test.mp4",
        content: {
          type: "video/mp4"
        }
      };
      fixture.detectChanges();

      expect(viewComponent.componentInstance.contentType).toBe("video/mp4");
      expect(viewComponent.componentInstance.ready).toBe(false);
    });

    it("should not show other types", () => {
      fixture.componentInstance.blob = {
        url: "http://example/test.json",
        content: {
          type: "application/json"
        }
      };
      fixture.detectChanges();

      expect(viewComponent.componentInstance.contentType).toBe("application/json");
      expect(viewComponent.componentInstance.ready).toBe(true);
    });
  });
});
