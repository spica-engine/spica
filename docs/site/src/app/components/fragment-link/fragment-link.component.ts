import {Component, Input} from "@angular/core";

@Component({
  templateUrl: "./fragment-link.component.html",
  styleUrls: ["./fragment-link.component.css"]
})
export class FragmentLinkComponent {
  @Input() url: string;
}
