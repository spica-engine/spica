import {HttpResponse} from "@angular/common/http";
import {HttpClientTestingModule, HttpTestingController} from "@angular/common/http/testing";
import {Component, DebugElement} from "@angular/core";
import {ComponentFixture, TestBed, fakeAsync} from "@angular/core/testing";
import {MatIconModule} from "@angular/material/icon";
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

    beforeEach(() => {
      httpTestingController = TestBed.get(HttpTestingController);
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

    /**
     Error: Expected false to be true.
      at <Jasmine>
      at http://localhost:9876/_karma_webpack_/src/storage/components/storage-view/storage-view.component.spec.ts:129:55
      at ZoneDelegate.invokeTask (http://localhost:9876/spica/node_modules/zone.js/dist/zone-evergreen.js:399:1)
      at ProxyZoneSpec.push.../../node_modules/zone.js/dist/zone-testing.js.ProxyZoneSpec.onInvokeTask (http://localhost:9876/spica/node_modules/zone.js/dist/zone-testing.js:323:1)
    */
    xit("should show images", () => {
      fixture.componentInstance.blob = "http://example/test.png";
      fixture.detectChanges();
      fixture.detectChanges();

      const req = httpTestingController.expectOne("http://example/test.png");
      req.flush(
        base64toBlob(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
          "image/png"
        )
      );
      fixture.detectChanges();

      expect(viewComponent.componentInstance.contentType).toBe("image/png");
      expect(viewComponent.query(By.css("img")).nativeElement.src).toBeTruthy();
    });

    xit("should show videos", () => {
      fixture.componentInstance.blob = "http://example/test.mp4";
      fixture.detectChanges();

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
    });
  });

  describe("with blob", () => {
    it("should show images", () => {
      fixture.componentInstance.blob = base64toBlob(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "image/png"
      );
      fixture.detectChanges();

      expect(viewComponent.componentInstance.contentType).toBe("image/png");
    });

    xit("should show videos", () => {
      fixture.componentInstance.blob = new Blob(["1"], {type: "video/mp4"});
      fixture.detectChanges();

      expect(viewComponent.componentInstance.contentType).toBe("video/mp4");
    });
  });

  describe("with storage object", () => {
    let httpTestingController: HttpTestingController;

    beforeEach(() => {
      httpTestingController = TestBed.get(HttpTestingController);
    });

    it("should show images", fakeAsync(() => {
      fixture.componentInstance.blob = {
        url: "http://example/test.png",
        content: {
          type: "image/png"
        }
      };
      fixture.detectChanges();

      const req = httpTestingController.expectOne("http://example/test.png");
      req.event(
        new HttpResponse({
          body: new Blob([], {type: "image/png"}),
          status: 200,
          statusText: "OK"
        })
      );
      fixture.detectChanges();

      expect(viewComponent.componentInstance.contentType).toBe("image/png");
    }));

    xit("should show videos", () => {
      fixture.componentInstance.blob = {
        url: "http://example/test.mp4",
        content: {
          type: "video/mp4"
        }
      };
      fixture.detectChanges();

      expect(viewComponent.componentInstance.contentType).toBe("video/mp4");
    });
  });
});
