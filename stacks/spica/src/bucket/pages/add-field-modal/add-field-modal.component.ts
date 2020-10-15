import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { InputPlacerWithMetaPlacer } from '@spica-client/common';
import { InputResolver } from '@spica-client/common/input/input.resolver';
import { PredefinedDefault } from '@spica-client/passport/interfaces/predefined-default';
import { Property } from '@spica-client/passport/pages/identity-settings/identity-settings.component';

@Component({
  selector: 'app-add-field-modal',
  templateUrl: './add-field-modal.component.html',
  styleUrls: ['./add-field-modal.component.scss']
})
export class AddFieldModalComponent implements OnInit {

  step = 0;
  field: string;
  parentSchema: any;
  propertyKey: string = "";
  propertyKv: any;

  translatableTypes = ["string", "textarea", "array", "object", "richtext", "storage"];
  basicPropertyTypes = ["string", "textarea", "boolean", "number"];
  visibleTypes = ["string", "textarea", "boolean", "number", "relation", "date", "color", "storage"];
  immutableProperties: Array<string> = [];
  predefinedDefaults: {[key: string]: PredefinedDefault[]};

  systemFields: InputPlacerWithMetaPlacer[] = [];
  constructor(private _inputResolver: InputResolver,
    public dialogRef: MatDialogRef<AddFieldModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data) { }

  ngOnInit(): void {
    this._inputResolver.entries().map(e => this.systemFields.push(this._inputResolver.resolve(e)));
    this.parentSchema = this.data.parentSchema;
    this.predefinedDefaults = this.data.predefinedDefaults;
    this.immutableProperties = Object.keys(this.parentSchema.properties);
    if(this.data.propertyKey){
      this.step = 1;
      this.propertyKey = this.data.propertyKey;
      this.propertyKv = this.parentSchema.properties[this.propertyKey];
      this.field = this.propertyKv.type;
      this.propertyKv.value = this.systemFields.filter(systemField => systemField.type == this.field)[0];
    }
  }

  chooseFieldType(field) {
    this.field = field;
    this.step = 1;
  }

  addProperty(name: string, description: string = null) {
    if(!description)
      description = `Description of the ${name} input`;
    this.propertyKey = name.toLowerCase();
    if (name && !this.parentSchema.properties[this.propertyKey]) {
      this.propertyKv = this.parentSchema.properties[this.propertyKey] = {
        type: this.field,
        title: this.propertyKey,
        description: description,
        options: {
          position: "bottom"
        },
        value: this.systemFields.filter(systemField => systemField.type == this.field)[0]
      };
    }
  }

  save(){
    this.dialogRef.close();
  }


  toggleRequired(key: string, required: boolean) {
    this.parentSchema.required = this.parentSchema.required || [];
    required
      ? this.parentSchema.required.push(key)
      : this.parentSchema.required.splice(this.parentSchema.required.indexOf(key), 1);
  }
}
