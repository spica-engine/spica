import {
  AfterContentInit,
  Component,
  ComponentFactoryResolver,
  ComponentRef,
  ContentChildren,
  ElementRef,
  forwardRef,
  InjectFlags,
  Injector,
  Input,
  OnChanges,
  OnDestroy,
  QueryList,
  Renderer2,
  SimpleChange,
  SimpleChanges,
  ViewChild,
  ViewContainerRef
} from "@angular/core";
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from "@angular/forms";
import {MatLegacySuffix as MatSuffix} from "@angular/material/legacy-form-field";
import {InputSchema, INPUT_SCHEMA} from "./input";
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
  @Input("inputPlacer") schema: InputSchema;
  @Input() minimal: boolean;
  @Input() class: string;
  @Input() name: string;
  @Input() required: boolean;

  @ContentChildren(MatSuffix, {read: ElementRef})
  private matSuffix: QueryList<ElementRef>;

  @ViewChild("inputPlace", {read: ViewContainerRef, static: true})
  private _viewContainerRef: ViewContainerRef;

  private _placerRef: ComponentRef<any>;
  private _accessors: ControlValueAccessor[] = [];

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
    this._accessors.forEach(accessor => accessor.writeValue(obj));
  }

  registerOnChange(fn: any): void {
    this._onChange = fn;
    this._accessors.forEach(accessor => accessor.registerOnChange(fn));
  }

  registerOnTouched(fn: any): void {
    this._onTouched = fn;
    this._accessors.forEach(accessor => accessor.registerOnTouched(fn));
  }

  setDisabledState(disabled: boolean) {
    this._isDisabled = disabled;
    this._accessors
      .filter(accessor => typeof accessor.setDisabledState == "function")
      .forEach(accessor => accessor.setDisabledState(disabled));
  }

  ngAfterContentInit(): void {
    if (this.matSuffix.length) {
      this.ngOnChanges({
        schema: new SimpleChange(this.schema, this.schema, false)
      });
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.schema && this.schema) {
      if (this._placerRef) {
        this._viewContainerRef.remove(this._viewContainerRef.indexOf(this._placerRef.hostView));
      }
      const placer = this._inputResolver.resolve(this.schema.type);
      const placerFactory = this._componentFactoryResolver.resolveComponentFactory(placer.placer);

      const copySchema = {...this.schema};
      copySchema["$required"] = this.required;
      copySchema["$name"] = `${this.name}$$`;

      const injector = Injector.create(
        [
          {
            provide: INPUT_SCHEMA,
            useValue: copySchema
          }
        ],
        this._injector
      );

      this._placerRef = this._viewContainerRef.createComponent(placerFactory, null, injector, [
        this.matSuffix ? this.matSuffix.toArray().map(e => e.nativeElement) : []
      ]);

      this._accessors = this._placerRef.injector
        .get<ControlValueAccessor[]>(NG_VALUE_ACCESSOR, [], InjectFlags.Optional & InjectFlags.Self)
        .filter(ac => ac != this);

      if (!changes.schema.firstChange) {
        this.registerOnChange(this._onChange);
        this.registerOnTouched(this._onTouched);
        this.setDisabledState(this._isDisabled);
      }

      if (this.class) {
        this._renderer.addClass(this._placerRef.location.nativeElement, this.class);
      }

      this._renderer.addClass(this._placerRef.location.nativeElement, this.schema.type);
      this._renderer.addClass(this._placerRef.location.nativeElement, "input-placer-input");

      if (this.minimal) {
        this._renderer.addClass(this._placerRef.location.nativeElement, "minimal-input-placer");
      }
    } else if (changes.schema && !this.schema && this._placerRef) {
      this._viewContainerRef.remove(this._viewContainerRef.indexOf(this._placerRef.hostView));
    }

    if (changes.class && this._placerRef) {
      this._renderer.removeClass(
        this._placerRef.location.nativeElement,
        changes.class.previousValue
      );
      this._renderer.addClass(this._placerRef.location.nativeElement, this.class);
    }
  }

  ngOnDestroy(): void {
    if (this._placerRef) {
      this._viewContainerRef.remove(this._viewContainerRef.indexOf(this._placerRef.hostView));
    }
  }
}
