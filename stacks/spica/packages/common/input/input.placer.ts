import {
  AfterContentInit,
  Component,
  ComponentFactoryResolver,
  ComponentRef,
  ContentChildren,
  ElementRef,
  forwardRef,
  Injector,
  Input,
  OnChanges,
  OnDestroy,
  QueryList,
  Renderer2,
  SimpleChanges,
  ViewChild,
  ViewContainerRef
} from "@angular/core";
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from "@angular/forms";
import {MatSuffix} from "@angular/material/form-field";
import {InputPlacerOptions, InputSchema, INPUT_OPTIONS, INPUT_SCHEMA} from "./input";
import {InputResolver} from "./input.resolver";

@Component({
  selector: "[inputPlacer]",
  template: `
    <ng-content></ng-content>
    <ng-container #inputPlace></ng-container>
    <ng-content select="[slot=after], mat-error"></ng-content>
  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputPlacerComponent),
      multi: true
    }
  ]
})
export class InputPlacerComponent
  implements ControlValueAccessor, OnDestroy, OnChanges, AfterContentInit {
  @Input() name: string;
  @Input() required: boolean;
  @Input("inputPlacer") inputProperty: InputSchema;
  @Input() class: string;
  @Input() options: InputPlacerOptions = {};

  @ContentChildren(MatSuffix, {read: ElementRef}) matSuffix: QueryList<ElementRef>;

  @ViewChild("inputPlace", {read: ViewContainerRef, static: true})
  _viewContainerRef: ViewContainerRef;

  private _placerRef: ComponentRef<any>;
  private _accessor: ControlValueAccessor;

  private _onTouched = () => {};
  private _onChange = () => {};
  private _isDisabled = false;

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
    this._onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this._accessor.registerOnTouched(fn);
    this._onTouched = fn;
  }

  setDisabledState(disabled: boolean) {
    this._isDisabled = disabled;
    if (typeof this._accessor.setDisabledState === "function") {
      this._accessor.setDisabledState(disabled);
    }
  }

  ngAfterContentInit(): void {
    if (this.matSuffix.length) {
      this.ngOnChanges({
        inputProperty: {
          firstChange: false,
          currentValue: this.inputProperty,
          previousValue: this.inputProperty,
          isFirstChange: () => false
        }
      });
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.inputProperty && this.inputProperty) {
      if (this._placerRef) {
        this._viewContainerRef.remove(this._viewContainerRef.indexOf(this._placerRef.hostView));
      }
      const placer = this._inputResolver.resolve(this.inputProperty.type);
      const placerFactory = this._componentFactoryResolver.resolveComponentFactory(placer.placer);

      const injector = Injector.create(
        [
          {
            provide: INPUT_SCHEMA,
            useValue: {
              ...this.inputProperty,
              $required: this.required,
              // Later we can make root properties to use
              // different names rather than real property name
              $name: `${this.name}_inner`
            }
          },
          {
            provide: INPUT_OPTIONS,
            useValue: this.options
          }
        ],
        this._injector
      );

      this._placerRef = this._viewContainerRef.createComponent(placerFactory, null, injector, [
        this.matSuffix ? this.matSuffix.toArray().map(e => e.nativeElement) : []
      ]);

      this._accessor = this._placerRef.injector.get(NG_VALUE_ACCESSOR);
      this._renderer.addClass(this._placerRef.location.nativeElement, this.inputProperty.type);
      this._renderer.addClass(this._placerRef.location.nativeElement, this.class);
      this._renderer.addClass(this._placerRef.location.nativeElement, "input-placer-input");

      this._accessor.registerOnChange(this._onChange);
      this._accessor.registerOnTouched(this._onTouched);

      this._accessor.setDisabledState && this._accessor.setDisabledState(this._isDisabled);
    } else if (changes.inputProperty && !this.inputProperty) {
      if (this._placerRef) {
        this._viewContainerRef.remove(this._viewContainerRef.indexOf(this._placerRef.hostView));
      }
    }
  }

  ngOnDestroy(): void {
    if (this._placerRef) {
      this._viewContainerRef.remove(this._viewContainerRef.indexOf(this._placerRef.hostView));
    }
  }
}
