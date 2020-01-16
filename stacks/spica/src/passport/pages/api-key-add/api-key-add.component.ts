import {Component, OnInit, TemplateRef, ViewChild} from "@angular/core";
import {ApiKey, emptyApiKey} from "src/passport/interfaces/api-key";
import {Router, ActivatedRoute} from "@angular/router";
import {filter, switchMap, take, tap} from "rxjs/operators";
import {ApiKeyService} from "src/passport/services/api-key.service";

@Component({
  selector: "app-api-key-add",
  templateUrl: "./api-key-add.component.html",
  styleUrls: ["./api-key-add.component.scss"]
})
export class ApiKeyAddComponent implements OnInit {
  @ViewChild("toolbar", {static: true}) toolbar: TemplateRef<any>;
  public apiKey: ApiKey = emptyApiKey();

  keys: ApiKey[] = [];

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private apiKeyService: ApiKeyService
  ) {}

  ngOnInit() {
    this.activatedRoute.params
      .pipe(
        filter(params => params.id),
        switchMap(params => this.apiKeyService.getApiKey(params.id)),
        take(1)
      )
      .subscribe(apiKey => (this.apiKey = apiKey));
  }

  saveApiKey() {
    (this.apiKey._id
      ? this.apiKeyService.updateApiKey(this.apiKey)
      : this.apiKeyService.insertApiKey(this.apiKey)
    )
      .toPromise()
      .then(() => this.router.navigate(["passport/api-key"]))
      .catch(error => console.log(error));
  }
}
