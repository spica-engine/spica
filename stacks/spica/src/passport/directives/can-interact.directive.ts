import {Directive, HostBinding, Input, OnInit, SimpleChanges} from "@angular/core";
import {PassportService} from "../services/passport.service";

@Directive({selector: "[canInteract]"})
export class CanInteractDirective implements OnInit {
  @HostBinding("style.visibility") _visible = "hidden";
  @Input("canInteract") action: string;

  constructor(private passport: PassportService) {}

  ngOnInit(): void {
    this.setVisible(this.action);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (
      changes.action.previousValue != undefined &&
      changes.action.currentValue != undefined &&
      changes.action.previousValue != changes.action.currentValue
    )
      this.setVisible(changes.action.currentValue);
  }

  setVisible(action: string) {
    this.passport
      .checkAllowed(action)
      .toPromise()
      .then(allowed => {
        this._visible = allowed ? "visible" : "hidden";
      });
  }
}

//This directive for test cases. Use it for modules which uses the actual directive on test files.
@Directive({selector: "[canInteract]"})
export class CanInteractDirectiveTest implements OnInit {
  @HostBinding("style.visibility") _visible = "visible";
  @Input("canInteract") action: string;

  ngOnInit() {}
}
