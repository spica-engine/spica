import {Component, OnInit, TemplateRef, ViewChild} from "@angular/core";
import {ApiKey, emptyApiKey} from "src/passport/interfaces/api-key";
import {Router} from "@angular/router";

@Component({
  selector: "app-api-key-add",
  templateUrl: "./api-key-add.component.html",
  styleUrls: ["./api-key-add.component.scss"]
})
export class ApiKeyAddComponent implements OnInit {
  @ViewChild("toolbar", {static: true}) toolbar: TemplateRef<any>;
  public apiKey: ApiKey = emptyApiKey();

  constructor(private router: Router) {}

  ngOnInit() {}

  saveApiKey() {
    //save logic
    //then
    this.router.navigate(["passport/api-key"]);
  }
}
