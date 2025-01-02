import {DragDropModule} from "@angular/cdk/drag-drop";
import {CommonModule} from "@angular/common";
import {
  ANALYZE_FOR_ENTRY_COMPONENTS,
  Inject,
  InjectionToken,
  ModuleWithProviders,
  NgModule,
  Optional
} from "@angular/core";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {MatBadgeModule} from "@angular/material/badge";
import {MatButtonModule} from "@angular/material/button";
import {MatCheckboxModule} from "@angular/material/checkbox";
import {MatChipsModule} from "@angular/material/chips";
import {MatCardModule} from "@angular/material/card";
import {MatNativeDateModule} from "@angular/material/core";
import {MatDatepickerModule} from "@angular/material/datepicker";
import {MatExpansionModule} from "@angular/material/expansion";
import {MatGridListModule} from "@angular/material/grid-list";
import {MatIconModule} from "@angular/material/icon";
import {MatLegacyInputModule as MatInputModule} from "@angular/material/legacy-input";
import {MatListModule} from "@angular/material/list";
import {MatLegacyMenuModule as MatMenuModule} from "@angular/material/legacy-menu";
import {MatLegacySelectModule as MatSelectModule} from "@angular/material/legacy-select";
import {MatLegacySlideToggleModule as MatSlideToggleModule} from "@angular/material/legacy-slide-toggle";
import {MatLegacyTooltipModule as MatTooltipModule} from "@angular/material/legacy-tooltip";
import {OwlDateTimeModule, OwlNativeDateTimeModule} from "@danielmoncada/angular-datetime-picker";
import {ArraySchemaComponent} from "./components/array-schema/array-schema.component";
import {ArrayComponent} from "./components/array/array.component";
import {ArrayControlContainer} from "./components/array/array.container";
import {BooleanSchemaComponent} from "./components/boolean-schema/boolean-schema.component";
import {BooleanComponent} from "./components/boolean/boolean.component";
import {ColorComponent} from "./components/color/color.component";
import {DateComponent} from "./components/date/date.component";
import {DateValidatorDirective} from "./components/date/date.validator";
import {EnumSchemaComponent} from "./components/enum-schema/enum-schema.component";
import {NumberSchemaComponent} from "./components/number-schema/number-schema.component";
import {NumberComponent} from "./components/number/number.component";
import {ObjectSchemaComponent} from "./components/object-schema/object-schema.component";
import {ObjectComponent} from "./components/object/object.component";
import {StringSchemaComponent} from "./components/string-schema/string-schema.component";
import {StringComponent} from "./components/string/string.component";
import {TextAreaComponent} from "./components/textarea/textarea.component";
import {InputPlacerWithMetaPlacer, INPUT_PLACERS} from "./input";
import {InputSchemaPlacer} from "./input-schema-placer/input.schema.placer";
import {InputPlacerComponent} from "./input.placer";
import {InputResolver} from "./input.resolver";
import {NgModelParentDirective} from "./ngmodel.parent";

import {
  MaxItemsValidator,
  MaxValidator,
  MinItemsValidator,
  MinValidator,
  UniqueItemsValidator
} from "./validators";

import {ConditionalSchemaPipe} from "./conditional";
import {MultiselectSchemaComponent} from "./components/multiselect-schema/multiselect-schema.component";
import {MultiselectComponent} from "./components/multiselect/multiselect.component";

export function coerceObject() {
  return {};
}

// TODO(thesayyn): Rewrite the whole placer system when we switch to ivy.
@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
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
    MatBadgeModule,
    MatMenuModule,
    MatDatepickerModule,
    MatCheckboxModule,
    MatTooltipModule,
    MatNativeDateModule,
    DragDropModule,
    OwlDateTimeModule,
    OwlNativeDateTimeModule
  ],
  exports: [
    InputPlacerComponent,
    InputSchemaPlacer,
    MaxValidator,
    MinValidator,
    ConditionalSchemaPipe
  ],
  declarations: [
    InputSchemaPlacer,
    InputPlacerComponent,
    StringComponent,
    StringSchemaComponent,
    EnumSchemaComponent,
    DateComponent,
    DateValidatorDirective,
    NumberComponent,
    NumberSchemaComponent,
    BooleanComponent,
    TextAreaComponent,
    ArrayComponent,
    ArraySchemaComponent,
    ObjectComponent,
    ObjectSchemaComponent,
    NgModelParentDirective,
    MinValidator,
    MaxValidator,
    UniqueItemsValidator,
    MinItemsValidator,
    MaxItemsValidator,
    ColorComponent,
    BooleanSchemaComponent,
    ArrayControlContainer,
    ConditionalSchemaPipe,
    MultiselectSchemaComponent,
    MultiselectComponent
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
        icon: "format_quote",
        color: "#5fa55a",
        placer: StringComponent,
        metaPlacer: StringSchemaComponent
      },
      {
        origin: "string",
        type: "date",
        icon: "calendar_today",
        color: "#01b4bc",
        placer: DateComponent
      },
      {
        origin: "number",
        type: "number",
        icon: "looks_one",
        color: "#dabd1a",
        placer: NumberComponent,
        metaPlacer: NumberSchemaComponent
      },
      {
        origin: "boolean",
        type: "boolean",
        icon: "exposure",
        color: "#fa8925",
        placer: BooleanComponent,
        metaPlacer: BooleanSchemaComponent
      },
      {
        origin: "string",
        type: "textarea",
        icon: "format_size",
        color: "#fa5457",
        placer: TextAreaComponent
      },
      {
        origin: "array",
        type: "array",
        icon: "ballot",
        color: "#17a98e",
        placer: ArrayComponent,
        metaPlacer: ArraySchemaComponent
      },
      {
        origin: "array",
        type: "multiselect",
        title: "Multiple Selection",
        icon: "checklist",
        color: "#17a98e",
        placer: MultiselectComponent,
        metaPlacer: MultiselectSchemaComponent
      },
      {
        origin: "object",
        type: "object",
        icon: "all_out",
        color: "#1abfda",
        placer: ObjectComponent,
        metaPlacer: ObjectSchemaComponent,
        coerce: coerceObject
      },
      {
        origin: "string",
        type: "color",
        icon: "invert_colors",
        color: "#381ada",
        placer: ColorComponent
      }
    ])
  ]
})
export class InputModule {
  static withPlacers(placers: InputPlacerWithMetaPlacer[]): ModuleWithProviders<InputModule> {
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
