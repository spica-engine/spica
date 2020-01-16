import {Component, OnInit, TemplateRef, ViewChild} from "@angular/core";
import {ApiKey, emptyApiKey} from "src/passport/interfaces/api-key";
import {Router, ActivatedRoute} from "@angular/router";
import {filter, switchMap, take} from "rxjs/operators";
import {of} from "rxjs";

@Component({
  selector: "app-api-key-add",
  templateUrl: "./api-key-add.component.html",
  styleUrls: ["./api-key-add.component.scss"]
})
export class ApiKeyAddComponent implements OnInit {
  @ViewChild("toolbar", {static: true}) toolbar: TemplateRef<any>;
  public apiKey: ApiKey = emptyApiKey();

  keys: ApiKey[] = [
    {
      _id: "1",
      description: "description1",
      name: "name1",
      policies: [],
      active: true
    },
    {
      _id: "2",
      description: "description2",
      name: "name2",
      policies: [],
      active: true
    },
    {
      _id: "3",
      description: "description3",
      name: "name3",
      policies: [],
      active: true
    }
  ];

  constructor(private router: Router, private activatedRoute: ActivatedRoute) {}

  ngOnInit() {
    this.activatedRoute.params
      .pipe(
        filter(params => params.id),
        switchMap(params => of(this.keys.find(val => val._id == params.id) as ApiKey)),
        take(1)
      )
      .subscribe(apiKey => (this.apiKey = apiKey));
  }

  saveApiKey() {
    //save logic
    //then
    this.router.navigate(["passport/api-key"]);
  }
}
