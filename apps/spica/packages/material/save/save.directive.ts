import {Directive, Input, TemplateRef, ViewContainerRef} from "@angular/core";
import {SavingState} from "./interface";

@Directive({
  selector: "[matSave]",
  exportAs: "matSave"
})
export class MatSaveDirective {
  private _context = new MatSaveContext<SavingState>();
  private _timeout;

  @Input()
  set matSave(state: SavingState) {
    if (this._timeout) {
      clearTimeout(this._timeout);
    }

    if (
      this._context.$implicit != state &&
      (SavingState.Saved == state || SavingState.Failed == state)
    ) {
      this._timeout = setTimeout(
        () => (this._context.$implicit = this._context.state = SavingState.Pristine),
        this.resetTimeout
      );
    }

    this._context.$implicit = this._context.state = state;
  }

  @Input("matSaveTimeout") resetTimeout: number = 1000;

  constructor(vcRef: ViewContainerRef, templateRef: TemplateRef<unknown>) {
    vcRef.createEmbeddedView(templateRef, this._context);
  }
}

export class MatSaveContext<T = unknown> {
  public $implicit: T;
  public state: T;
}
