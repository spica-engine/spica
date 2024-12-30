import {
  Component,
  ElementRef,
  Inject,
  Input,
  OnChanges,
  SimpleChanges,
  ViewChild
} from "@angular/core";
import {UntypedFormControl} from "@angular/forms";
import {MatLegacyChipInputEvent as MatChipInputEvent} from "@angular/material/legacy-chips";
import {InputSchema, INPUT_SCHEMA} from "../../input";
import {COMMA, ENTER} from "@angular/cdk/keycodes";

@Component({
  templateUrl: "./enum-schema.component.html",
  selector: "enum-schema",
  styleUrls: ["./enum-schema.component.scss"]
})
export class EnumSchemaComponent implements OnChanges {
  _trackBy: (i) => any = i => i;
  enumCtrl = new UntypedFormControl();

  separatorKeyCodes: number[] = [ENTER, COMMA];

  @Input("schema") _schema: InputSchema;

  constructor(@Inject(INPUT_SCHEMA) public schema: InputSchema) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes._schema) {
      this.schema = changes._schema.currentValue;
    }
  }

  addItem(event: MatChipInputEvent) {
    const value = this.prepareValue(event.value);

    if (!this.isValidValue(value)) {
      this.enumCtrl.setErrors({invalidType: true});
      return;
    }

    this.schema.enum ? this.schema.enum.push(value) : (this.schema.enum = [value]);

    if (event.chipInput?.inputElement) {
      event.chipInput.inputElement.value = "";
    }

    this.enumCtrl.setValue(null);
  }

  removeItem(index) {
    this.schema.enum.splice(index, 1);
    if (this.schema.enum.length < 1) {
      // empty enums are not allowed on the api
      delete this.schema.enum;
    }
  }

  isValidValue(value) {
    return value != null && value != undefined;
  }

  prepareValue(value: string) {
    value = value && value.trim().length ? value.trim() : undefined;

    switch (this.schema.type) {
      case "string":
        return value;
      case "number":
        return !isNaN(parseInt(value)) ? parseInt(value) : undefined;
      default:
        value;
    }
  }
}
