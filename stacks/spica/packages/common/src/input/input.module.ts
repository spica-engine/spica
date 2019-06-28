import {CommonModule} from "@angular/common";
import {
  ANALYZE_FOR_ENTRY_COMPONENTS,
  Inject,
  ModuleWithProviders,
  NgModule,
  Optional
} from "@angular/core";
import {FormsModule} from "@angular/forms";
import {MatButtonModule} from "@angular/material/button";
import {MatCardModule} from "@angular/material/card";
import {MatChipsModule} from "@angular/material/chips";
import {MatNativeDateModule} from "@angular/material/core";
import {MatDatepickerModule} from "@angular/material/datepicker";
import {MatExpansionModule} from "@angular/material/expansion";
import {MatGridListModule} from "@angular/material/grid-list";
import {MatIconModule} from "@angular/material/icon";
import {MatInputModule} from "@angular/material/input";
import {MatListModule} from "@angular/material/list";
import {MatSelectModule} from "@angular/material/select";
import {MatSlideToggleModule} from "@angular/material/slide-toggle";

import {ArraySchemaComponent} from "./components/array-schema/array-schema.component";
import {ArrayComponent} from "./components/array/array.component";
import {BooleanComponent} from "./components/boolean/boolean.component";
import {DateComponent} from "./components/date/date.component";
import {EnumSchemaComponent} from "./components/enum-schema/enum-schema.component";
import {NumberSchemaComponent} from "./components/number-schema/number-schema.component";
import {NumberComponent} from "./components/number/number.component";
import {ObjectSchemaComponent} from "./components/object-schema/object-schema.component";
import {ObjectComponent} from "./components/object/object.component";
import {StringSchemaComponent} from "./components/string-schema/string-schema.component";
import {StringComponent} from "./components/string/string.component";
import {TextAreaComponent} from "./components/textarea/textarea.component";
import {INPUT_PLACERS, InputPlacerWithMetaPlacer} from "./input";
import {InputSchemaPlacer} from "./input-schema-placer/input.schema.placer";
import {InputPlacerComponent} from "./input.placer";
import {InputResolver} from "./input.resolver";

export function coerceObject() {
  return {};
}

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    MatInputModule,
    MatIconModule,
    MatSelectModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatSlideToggleModule,
    MatExpansionModule,
    MatGridListModule,
    MatCardModule,
    MatListModule,
    MatDatepickerModule,
    MatNativeDateModule
  ],
  exports: [InputPlacerComponent, InputSchemaPlacer],
  declarations: [
    InputSchemaPlacer,
    InputPlacerComponent,
    StringComponent,
    StringSchemaComponent,
    EnumSchemaComponent,
    DateComponent,
    NumberComponent,
    NumberSchemaComponent,
    BooleanComponent,
    TextAreaComponent,
    ArrayComponent,
    ArraySchemaComponent,
    ObjectComponent,
    ObjectSchemaComponent
  ],
  providers: [
    {
      provide: InputResolver,
      useFactory: provideInputResolver,
      deps: [[new Inject(INPUT_PLACERS), new Optional()]]
    },
    providePlacers([
      {
        origin: "string",
        type: "string",
        placer: StringComponent,
        metaPlacer: StringSchemaComponent
      },
      {origin: "string", type: "date", placer: DateComponent},
      {
        origin: "number",
        type: "number",
        placer: NumberComponent,
        metaPlacer: NumberSchemaComponent
      },
      {origin: "boolean", type: "boolean", placer: BooleanComponent},
      {origin: "string", type: "textarea", placer: TextAreaComponent},
      {origin: "array", type: "array", placer: ArrayComponent, metaPlacer: ArraySchemaComponent},
      {
        origin: "object",
        type: "object",
        placer: ObjectComponent,
        metaPlacer: ObjectSchemaComponent,
        coerce: coerceObject
      }
    ])
  ]
})
export class InputModule {
  static withPlacers(placers: InputPlacerWithMetaPlacer[]): ModuleWithProviders {
    return {ngModule: InputModule, providers: providePlacers(placers)};
  }
}

export function provideInputResolver(placers: InputPlacerWithMetaPlacer[]) {
  return new InputResolver([].concat.apply([], placers));
}

export function providePlacers(placers: InputPlacerWithMetaPlacer[]): any {
  return [
    {provide: ANALYZE_FOR_ENTRY_COMPONENTS, multi: true, useValue: placers},
    {provide: INPUT_PLACERS, multi: true, useValue: placers}
  ];
}
