import {
  Component,
  ComponentFactoryResolver,
  ComponentRef,
  forwardRef,
  Injector,
  Input,
  OnDestroy,
  OnInit,
  Renderer2,
  ViewChild,
  ViewContainerRef
} from "@angular/core";
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from "@angular/forms";
import {InputPlacerOptions, INPUT_OPTIONS, INPUT_SCHEMA} from "./input";
import {InputResolver} from "./input.resolver";

@Component({
  selector: "[inputPlacer]",
  template: `
    <ng-content></ng-content>
    <ng-container #inputPlace></ng-container>
  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputPlacerComponent),
      multi: true
    }
  ]
})
export class InputPlacerComponent implements ControlValueAccessor, OnDestroy, OnInit {
  @Input("inputPlacer") inputProperty: any;
  @Input("options")
  options: InputPlacerOptions = {
    class: "input-placer-input"
  };

  @ViewChild("inputPlace", {read: ViewContainerRef, static: true}) _viewContainerRef;
  private _placerRef: ComponentRef<any>;
  private _accessor: ControlValueAccessor;

  constructor(
    private _injector: Injector,
    private _componentFactoryResolver: ComponentFactoryResolver,
    private _inputResolver: InputResolver,
    private _renderer: Renderer2
  ) {}

  writeValue(obj: any): void {
    this._accessor.writeValue(obj);
  }

  registerOnChange(fn: any): void {
    this._accessor.registerOnChange(fn);
  }

  registerOnTouched(fn: any): void {
    this._accessor.registerOnTouched(fn);
  }

  setDisabledState(disabled: boolean) {
    if (typeof this._accessor.setDisabledState === "function") {
      this._accessor.setDisabledState(disabled);
    }
  }

  ngOnInit(): void {
    const placer = this._inputResolver.resolve(this.inputProperty.type);
    const placerFactory = this._componentFactoryResolver.resolveComponentFactory(placer.placer);
    const injector = Injector.create(
      [
        {
          provide: INPUT_SCHEMA,
          useValue: this.inputProperty
        },
        {
          provide: INPUT_OPTIONS,
          useValue: this.options
        }
      ],
      this._injector
    );
    this._placerRef = this._viewContainerRef.createComponent(placerFactory, null, injector);

    this._accessor = this._placerRef.injector.get(NG_VALUE_ACCESSOR);
    this._renderer.addClass(this._placerRef.location.nativeElement, this.options.class);
  }

  ngOnDestroy(): void {
    if (this._placerRef) {
      this._viewContainerRef.remove(this._viewContainerRef.indexOf(this._placerRef.hostView));
    }
  }
}
