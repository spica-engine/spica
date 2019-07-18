import {ChangeDetectionStrategy, Component, Input} from "@angular/core";

@Component({
  templateUrl: "./fragment-link.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FragmentLinkComponent {
  @Input() url: string;
}
