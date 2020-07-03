import {Directive, HostBinding, Input, OnInit, SimpleChanges} from "@angular/core";
import {PassportService} from "../services/passport.service";

@Directive({selector: "[canInteract]"})
export class CanInteractDirective implements OnInit {
  @HostBinding("style.visibility") _visible = "hidden";
  @Input("canInteract") action: string;
  @Input() resource: string;

  constructor(private passport: PassportService) {}

  ngOnInit(): void {
    this.setVisible(this.action, this.resource);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (
      changes.action.previousValue != undefined &&
      changes.action.currentValue != undefined &&
      changes.action.previousValue != changes.action.currentValue
    )
      this.setVisible(changes.action.currentValue, changes.resource.currentValue);
  }

  setVisible(action: string, resource: string) {
    this.passport
      .checkAllowed(action, resource)
      .toPromise()
      .then(allowed => {
        this._visible = allowed ? "visible" : "hidden";
      });
  }
}
