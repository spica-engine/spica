import {TestBed, ComponentFixture, tick, fakeAsync, async} from "@angular/core/testing";
import {LocationComponent} from "./location.component";
import {MatFormFieldModule} from "@angular/material/form-field";
import {FormsModule} from "@angular/forms";
import {MatTooltipModule} from "@angular/material/tooltip";
import {MatIconModule, MatInputModule} from "@angular/material";
import {LeafletModule} from "@asymmetrik/ngx-leaflet";
import {EMPTY_INPUT_SCHEMA, INPUT_SCHEMA} from "../../../../packages/common";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {By} from "@angular/platform-browser";
import {ChangeDetectorRef} from "@angular/core";
import {LatLng, LatLngExpression} from "leaflet";

describe("LocationComponent", () => {
  describe("basic behavior", () => {
    let component: LocationComponent;
    let fixture: ComponentFixture<LocationComponent>;
    let compiled;
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
      compiled = fixture.debugElement.nativeElement;
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it("should render component ", () => {
      const cameraButton = compiled.querySelector("button:first-of-type");
      expect(cameraButton.getAttribute("ng-reflect-message")).toBe("Show Latitude and Longitude");
      expect(cameraButton.textContent).toBe("control_camera");

      const locationButton = compiled.querySelector("button:last-of-type");
      expect(locationButton.getAttribute("ng-reflect-message")).toBe("Set to current location");
      expect(locationButton.disabled).toBe(false);
      expect(locationButton.textContent).toBe("my_location");
    });

    it("should show coordinates when clicked control camera button", () => {
      component.value = {
        latitude: 35,
        longitude: 45
      };

      const cameraButton = compiled.querySelector("button:first-of-type");
      cameraButton.click();
      fixture.detectChanges();

      expect(component.showLatLng).toBe(true);
      expect(cameraButton.getAttribute("ng-reflect-message")).toBe("Hide Latitude and Longitude");

      expect(compiled.querySelector("mat-form-field:first-of-type").textContent).toBe("Latitude");

      const latitudeInput = compiled.querySelector("input:first-of-type");
      expect(latitudeInput.disabled).toBe(false);
      expect(latitudeInput.getAttribute("ng-reflect-model")).toBe("35");

      expect(compiled.querySelector("mat-form-field:last-of-type").textContent).toBe("Longitude");

      const longitudeInput = compiled.querySelectorAll("mat-form-field")[1].querySelector("input");
      expect(longitudeInput.disabled).toBe(false);
      expect(longitudeInput.getAttribute("ng-reflect-model")).toBe("45");
    });

    it("should change coordinates", fakeAsync(() => {
      component.value = {
        latitude: 0,
        longitude: 0
      };

      const cameraButton = compiled.querySelector("button:first-of-type");
      cameraButton.click();
      fixture.detectChanges();

      const latitudeInput = compiled.querySelector("input:first-of-type");
      const longitudeInput = compiled.querySelectorAll("mat-form-field")[1].querySelector("input");
      latitudeInput.value = 33;
      longitudeInput.value = 55;

      latitudeInput.dispatchEvent(new Event("input"));
      longitudeInput.dispatchEvent(new Event("input"));

      fixture.detectChanges();
      tick(501);

      expect(component.value).toEqual({
        latitude: 33,
        longitude: 55
      });

      expect(component._marker.getLatLng()).toEqual(new LatLng(33, 55));

      expect(component._center[0]).toBe(33);
      expect(component._center[1]).toBe(55);
    }));
  });

  describe("should work with user current location", () => {
    let component: LocationComponent;
    let fixture: ComponentFixture<LocationComponent>;
    let compiled;
    let coordinateSpy;
    let markForCheckSpy;

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

      coordinateSpy = spyOn(navigator.geolocation, "getCurrentPosition").and.callFake(function() {
        var position = {coords: {latitude: 32, longitude: 33}};
        arguments[0](position);
      });

      fixture = TestBed.createComponent(LocationComponent);
      component = fixture.componentInstance;
      compiled = fixture.debugElement.nativeElement;
      markForCheckSpy = spyOn(component["cd"], "markForCheck");
      fixture.detectChanges();
    });

    it("should show current location", fakeAsync(() => {
      compiled.querySelector("button:last-of-type").click();
      tick(501);
      fixture.detectChanges();

      expect(coordinateSpy).toHaveBeenCalledTimes(1);
      expect(component.value).toEqual({
        latitude: 32,
        longitude: 33
      });
      expect(component._center[0]).toBe(32);
      expect(component._center[1]).toBe(33);
      expect(component._marker.getLatLng()).toEqual(new LatLng(32, 33));

      // expect(markForCheckSpy).toHaveBeenCalledTimes(1);
    }));
  });

  describe("should work with no user location", () => {
    let component: LocationComponent;
    let fixture: ComponentFixture<LocationComponent>;
    let compiled;
    let isEnableSpy;

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

      isEnableSpy = spyOnProperty(navigator, "geolocation", "get").and.returnValue(undefined);

      fixture = TestBed.createComponent(LocationComponent);
      compiled = fixture.debugElement.nativeElement;
      component = fixture.componentInstance;
      fixture.detectChanges();
    });
    it("should show disabled my location button", () => {
      expect(isEnableSpy).toHaveBeenCalledTimes(1);
      expect(compiled.querySelector("button:last-of-type").disabled).toBe(true);
    });
  });
});
