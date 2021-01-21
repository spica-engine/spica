import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  forwardRef,
  HostListener,
  Inject,
  OnDestroy,
  OnInit,
  ViewChild
} from "@angular/core";
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from "@angular/forms";
import {LeafletDirective} from "@asymmetrik/ngx-leaflet";
import {InputSchema, INPUT_SCHEMA} from "@spica-client/common";
import {icon, LatLngExpression, LeafletMouseEvent, marker, Marker, tileLayer} from "leaflet";

@Component({
  templateUrl: "./location.component.html",
  styleUrls: ["./location.component.scss"],
  viewProviders: [
    {
      provide: NG_VALUE_ACCESSOR,
      multi: true,
      useExisting: forwardRef(() => LocationComponent)
    }
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LocationComponent implements ControlValueAccessor, OnDestroy, OnInit {
  @ViewChild(LeafletDirective, {static: true}) map: LeafletDirective;

  value = {
    type: this.schema["locationType"] || "Point",
    coordinates: [null, null]
  };

  _disabled: boolean = false;
  _onChangeFn: Function = () => {};
  _onTouchedFn: Function = () => {};

  _center: LatLngExpression;
  _options = {
    layers: [
      tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        maxZoom: 18
      })
    ],
    zoom: 5,
    center: [36.9, 30.642],
    zoomControl: false,
    trackResize: true
  };

  _marker: Marker = marker([36.9, 30.642], {
    icon: icon({
      iconSize: [24, 24],
      iconAnchor: [24, 24],
      iconUrl: "assets/baseline-location.svg"
    }),
    draggable: !this._disabled,
    autoPan: true
  });

  showLatLng: boolean = false;

  get isGeolocationSupported() {
    return navigator.geolocation;
  }

  constructor(@Inject(INPUT_SCHEMA) public schema: InputSchema, private cd: ChangeDetectorRef) {
    this._marker.on("move", this.onMoveMarker.bind(this));
  }

  ngOnInit(): void {
    this.map.onResize();
  }

  ngOnDestroy(): void {
    this._marker.off("move", this.onMoveMarker);
  }

  onMoveMarker(event: LeafletMouseEvent) {
    this.applyCoords(event.latlng, true);
    this.callOnChange();
  }

  applyCoords(latLng?: {lat: number; lng: number}, mapOnly: boolean = false) {
    if (latLng && !this._disabled) {
      this.value.coordinates[1] = latLng.lat;
      this.value.coordinates[0] = latLng.lng;
    }
    if (!mapOnly) {
      this._marker.setLatLng([this.value.coordinates[1], this.value.coordinates[0]]);
    }
    setTimeout(() => {
      this._center = [this.value.coordinates[1], this.value.coordinates[0]];
      this.cd.markForCheck();
    }, 500);
  }

  setToCurrentLocation() {
    navigator.geolocation.getCurrentPosition(location => {
      this.applyCoords({lat: location.coords.latitude, lng: location.coords.longitude});
    });
  }

  callOnChange() {
    this._onChangeFn(this.value);
  }

  @HostListener("click")
  callOnTouched(): void {
    this._onTouchedFn();
  }

  writeValue(val: any): void {
    if (val && typeof val === "object" && val !== null) {
      this.value = val;
      this.applyCoords();
      this.cd.markForCheck();
    }
  }

  registerOnChange(fn: any): void {
    this._onChangeFn = fn;
  }

  registerOnTouched(fn: any): void {
    this._onTouchedFn = fn;
  }

  setDisabledState?(isDisabled: boolean): void {
    this._disabled = isDisabled;
    this._marker.dragging && this._marker.dragging.disable();
  }
}

export function createLocation() {
  return {longitude: 0, latitude: 0};
}
