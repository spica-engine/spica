import {
  Component,
  forwardRef,
  Injector,
  Input,
  OnChanges,
  SimpleChanges,
  Type
} from "@angular/core";
import {ControlValueAccessor, NG_VALUE_ACCESSOR} from "@angular/forms";
import {EMPTY_INPUT_SCHEMA, InputSchema, INPUT_SCHEMA} from "../input";
import {InputResolver} from "../input.resolver";

@Component({
  selector: "[inputSchemaPlacer][ngModel], input-schema-placer",
  templateUrl: "./input.schema.placer.html",
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputSchemaPlacer),
      multi: true
    }
  ],
  styles: [
    `
      :host {
        display: block;
      }
      mat-form-field:not(:first-child-of-type) {
        margin-left: 5px;
      }
    `
  ]
})
export class InputSchemaPlacer implements OnChanges, ControlValueAccessor {
  @Input("inputSchemaPlacer") type: string;

  public placer: Type<any>;
  public injector: Injector;

  public inputTypes: string[];

  public schema: InputSchema = {...EMPTY_INPUT_SCHEMA};
  public onChangeFn: Function = () => {};
  public onTouchFn: Function = () => {};

  constructor(private _injector: Injector, private _inputResolver: InputResolver) {
    this.inputTypes = this._inputResolver.entries();
  }

  writeValue(obj: any): void {
    if (obj) {
      this.schema = obj;
      if (this.type) {
        this.updatePlacer();
      }
    }
  }

  registerOnChange(fn: any): void {
    this.onChangeFn = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouchFn = fn;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.type && this.type) {
      for (const key of Object.keys(this.schema)) {
        if (key === "type" || key === "description" || key === "options") {
          continue;
        }
        delete this.schema[key];
      }
      this.updatePlacer();
    }
  }

  updatePlacer(): void {
    const placer = this._inputResolver.resolve(this.type);
    if (!!placer && !!placer.metaPlacer && !!this.schema) {
      this.placer = placer.metaPlacer;
      this.injector = Injector.create(
        [
          {
            provide: INPUT_SCHEMA,
            useValue: this.schema
          }
        ],
        this._injector
      );
    } else {
      this.placer = undefined;
      this.injector = undefined;
    }
  }
}
