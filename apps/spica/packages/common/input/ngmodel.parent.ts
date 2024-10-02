import {Directive, SkipSelf, Optional} from "@angular/core";
import {ControlContainer} from "@angular/forms";

export function provideHierarchicalControlContainer(container: ControlContainer) {
  return container;
}

/**
 * This directive simply re-exports the ControlContainer from
 * hierarchical dependency injection tree to host dependency
 * injector.
 * Checkout: https://github.com/angular/angular/blob/bbb27b5517d2ed9fd3cd924b45d8f40a4e68187f/packages/forms/src/directives/ng_model.ts#L195
 */
@Directive({
  selector: "[ngModelParent][ngModel]",
  providers: [
    {
      provide: ControlContainer,
      useFactory: provideHierarchicalControlContainer,
      deps: [[new Optional(), new SkipSelf(), ControlContainer]]
    }
  ]
})
export class NgModelParentDirective {}
