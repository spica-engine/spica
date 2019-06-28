import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  HostListener,
  Inject,
  ViewChild
} from "@angular/core";
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from "@angular/forms";
import {InputSchema, INPUT_SCHEMA} from "@spica-client/common";
import {
  icon,
  marker,
  Marker,
  tileLayer,
  LatLng,
  LatLngExpression,
  LeafletMouseEvent
} from "leaflet";
import {LeafletDirective} from "@asymmetrik/ngx-leaflet";

@Component({
  templateUrl: "./location.component.html",
  styleUrls: ["./location.component.scss"],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => LocationComponent)
    }
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LocationComponent implements ControlValueAccessor {
  @ViewChild(LeafletDirective, {static: true}) map: LeafletDirective;

  constructor(@Inject(INPUT_SCHEMA) public schema: InputSchema) {
    this._marker.on("move", (event: LeafletMouseEvent) => {
      this.applyCoords(event.latlng, true);
      this.callOnChange();
    });
  }

  value = {
    lat: undefined,
    long: undefined
  };

  _disabled: boolean = false;
  _onChangeFn: any;
  _onTouchedFn: any;
  _center: LatLngExpression;

  _options = {
    layers: [
      tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        maxZoom: 18
      })
    ],
    zoom: 5,
    center: [36.9, 30.642]
  };

  _marker: Marker = marker([36.9, 30.642], {
    icon: icon({
      iconSize: [24, 24],
      iconAnchor: [24, 24],
      iconUrl: "assets/baseline-location.svg"
    }),
    draggable: true,
    autoPan: true
  });

  applyCoords(latLng?: LatLng, mapOnly: boolean = false) {
    if (latLng && !this._disabled) {
      this.value.lat = latLng.lat;
      this.value.long = latLng.lng;
    }
    if (!mapOnly) {
      this._marker.setLatLng([this.value.lat, this.value.long]);
    }
    setTimeout(() => (this._center = [this.value.lat, this.value.long]), 1000);
  }

  @HostListener("click")
  callOnTouched(): void {
    if (this._onTouchedFn) {
      this._onTouchedFn();
    }
  }

  callOnChange() {
    if (this._onChangeFn) {
      this._onChangeFn(this.value);
    }
  }

  writeValue(val: any): void {
    if (val && typeof val === "object" && val !== null) {
      this.value = val;
      this.applyCoords();
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
    this._marker.dragging.disable();
  }
}
