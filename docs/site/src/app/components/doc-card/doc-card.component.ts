import {ChangeDetectionStrategy, Component, Input, OnInit} from "@angular/core";
import {fly, flyOne} from "../../pages/animations";
@Component({
  selector: "app-doc-card",
  templateUrl: "./doc-card.component.html",
  styleUrls: ["./doc-card.component.css"],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [fly("fly"), flyOne("flyOne")]
})
export class DocCardComponent implements OnInit {
  @Input() image: string;
  @Input() title: string;
  @Input() href: string;
  constructor() {}

  ngOnInit() {}
}
