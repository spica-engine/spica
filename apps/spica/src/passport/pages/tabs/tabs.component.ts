import {Component, OnInit} from "@angular/core";
import {ActivatedRoute, RouterOutlet} from "@angular/router";
import {ToolbarService} from "../../services/toolbar.service";

@Component({
  selector: "passport-tabs",
  templateUrl: "./tabs.component.html",
  styleUrls: ["./tabs.component.scss"]
})
export class TabsComponent implements OnInit {
  toolbarTemplate$ = this.toolbarService.toolbarTemplate.asObservable();

  constructor(private toolbarService: ToolbarService) {}

  ngOnInit() {}
}
