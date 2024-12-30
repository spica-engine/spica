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
import {PresetLoader, presets, STRING_PRESET_LOADER} from "./predefineds";

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
            `,
    `
              :host > mat-form-field:not(:first-of-type) {
                margin: 0px 5px;
              }
            `,
    `
              :host > mat-form-field:first-of-type {
                margin-right: 5px;
              }
            `
  ]
})
export class InputSchemaPlacer implements OnChanges, ControlValueAccessor {
  @Input("inputSchemaPlacer") type: string;

  @Input() forbiddenTypes: string[];
  @Input() advancedOnly: boolean = false;

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
        if (key === "type" || key === "title" || key === "description" || key === "options") {
          continue;
        }
        delete this.schema[key];
      }
      this.updatePlacer();
    }
    if (changes.forbiddenTypes) {
      this.inputTypes = this.inputTypes.filter(type => this.forbiddenTypes.indexOf(type) == -1);
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
          },
          {
            provide: STRING_PRESET_LOADER,
            useFactory: () => {
              const loader = new PresetLoader();
              loader.add(presets);
              return loader;
            }
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
