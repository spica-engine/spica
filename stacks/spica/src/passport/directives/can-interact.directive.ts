import {Directive, HostBinding, Input, OnInit} from "@angular/core";
import {PassportService} from "../services/passport.service";

@Directive({selector: "[canInteract]"})
export class CanInteractDirective implements OnInit {
  @HostBinding("style.visibility") _visible = "hidden";
  @Input("canInteract") action: string;

  constructor(private passport: PassportService) {}

  ngOnInit(): void {
    this.passport
      .checkAllowed(this.action)
      .toPromise()
      .then(allowed => (this._visible = allowed ? "visible" : "hidden"));
  }
}
