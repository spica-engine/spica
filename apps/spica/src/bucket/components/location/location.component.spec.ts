import {ChangeDetectorRef} from "@angular/core";
import {ComponentFixture, fakeAsync, TestBed, tick} from "@angular/core/testing";
import {FormsModule} from "@angular/forms";
import {MatIconModule} from "@angular/material/icon";
import {MatInputModule} from "@angular/material/input";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatTooltip, MatTooltipModule} from "@angular/material/tooltip";
import {By} from "@angular/platform-browser";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {LeafletModule} from "@asymmetrik/ngx-leaflet";
import {LatLng} from "leaflet";
import {EMPTY_INPUT_SCHEMA, INPUT_SCHEMA} from "../../../../packages/common";
import {LocationComponent} from "./location.component";

describe("LocationComponent", () => {
  let fixture: ComponentFixture<LocationComponent>;
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        MatInputModule,
        MatFormFieldModule,
        FormsModule,
        MatTooltipModule,
        MatIconModule,
        LeafletModule,
        NoopAnimationsModule
      ],
      providers: [
        {
          provide: INPUT_SCHEMA,
          useValue: EMPTY_INPUT_SCHEMA
        }
      ],
      declarations: [LocationComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(LocationComponent);
    fixture.detectChanges();
  });

  describe("basic behavior", () => {
    it("should render component ", () => {
      fixture.detectChanges();
      const cameraButton = fixture.debugElement.query(By.css("button:first-of-type"));
      expect(cameraButton.injector.get(MatTooltip).message).toBe("Show Latitude and Longitude");
      expect(cameraButton.nativeElement.textContent).toBe("control_camera");

      const locationButton = fixture.debugElement.query(By.css("button:last-of-type"));

      expect(locationButton.injector.get(MatTooltip).message).toBe("Set to current location");
      expect(locationButton.nativeElement.disabled).toBe(false);
      expect(locationButton.nativeElement.textContent).toBe("my_location");
    });

    it("should show coordinates when clicked control camera button", fakeAsync(() => {
      fixture.componentInstance.value = {
        type: "Point",
        coordinates: [45, 35]
      };
      const cameraButton = fixture.debugElement.query(By.css("button:first-of-type"));
      cameraButton.nativeElement.click();
      fixture.detectChanges();

      tick();

      expect(fixture.componentInstance.showLatLng).toBe(true);
      expect(cameraButton.injector.get(MatTooltip).message).toBe("Hide Latitude and Longitude");

      expect(
        fixture.debugElement.query(By.css("mat-form-field:first-of-type")).nativeElement.textContent
      ).toBe("Latitude");

      const latitudeInput = fixture.debugElement.query(By.css("input:first-of-type"));
      expect(latitudeInput.nativeElement.disabled).toBe(false);
      expect(latitudeInput.nativeElement.value).toBe("35");

      expect(
        fixture.debugElement.query(By.css("mat-form-field:last-of-type")).nativeElement.textContent
      ).toBe("Longitude");

      const longitudeInput = fixture.debugElement.query(
        By.css("mat-form-field:last-of-type input")
      );
      expect(longitudeInput.nativeElement.disabled).toBe(false);
      expect(longitudeInput.nativeElement.value).toBe("45");
    }));

    it("should change coordinates through inputs", fakeAsync(() => {
      const cameraButton = fixture.debugElement.query(By.css("button:first-of-type"));
      cameraButton.nativeElement.click();
      fixture.detectChanges();

      const [latitudeInput, longitudeInput] = fixture.debugElement.queryAll(
        By.css("mat-form-field input")
      );
      latitudeInput.nativeElement.value = 33;
      longitudeInput.nativeElement.value = 55;

      latitudeInput.nativeElement.dispatchEvent(new Event("input"));
      longitudeInput.nativeElement.dispatchEvent(new Event("input"));

      fixture.detectChanges();
      tick(501);

      expect(fixture.componentInstance.value).toEqual({
        type: "Point",
        coordinates: [55, 33]
      });

      expect(fixture.componentInstance._marker.getLatLng()).toEqual(new LatLng(33, 55));
      expect(fixture.componentInstance._center[0]).toBe(33);
      expect(fixture.componentInstance._center[1]).toBe(55);
    }));
  });

  describe("through location", () => {
    let fixture: ComponentFixture<LocationComponent>;
    let coordinateSpy: jasmine.Spy;

    beforeEach(() => {
      coordinateSpy = spyOn(navigator.geolocation, "getCurrentPosition").and.callFake(
        (callback: Function) => callback({coords: {latitude: 32, longitude: 33}})
      );
      fixture = TestBed.createComponent(LocationComponent);
      fixture.detectChanges();
    });

    it("should show current location", fakeAsync(() => {
      fixture.debugElement.query(By.css("button:last-of-type")).nativeElement.click();
      tick(501);
      fixture.detectChanges();

      expect(coordinateSpy).toHaveBeenCalledTimes(1);
      expect(fixture.componentInstance.value).toEqual({
        type: "Point",
        coordinates: [33, 32]
      });
      expect(fixture.componentInstance._center[0]).toBe(32);
      expect(fixture.componentInstance._center[1]).toBe(33);
      expect(fixture.componentInstance._marker.getLatLng()).toEqual(new LatLng(32, 33));
    }));

    it("should show disabled my location button", () => {
      let button = fixture.debugElement.query(By.css("button:last-of-type"));
      expect(button.nativeElement.disabled).toBe(false);
      spyOnProperty(fixture.componentInstance, "isGeolocationSupported", "get").and.returnValue(
        false
      );
      fixture.componentRef.injector.get(ChangeDetectorRef).detectChanges();
      expect(button.nativeElement.disabled).toBe(true);
    });
  });
});
