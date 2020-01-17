import {Component, OnInit, TemplateRef, ViewChild} from "@angular/core";
import {ApiKey, emptyApiKey} from "src/passport/interfaces/api-key";
import {Router, ActivatedRoute} from "@angular/router";
import {filter, switchMap, take} from "rxjs/operators";
import {MockService} from "src/passport/services/api-key.service";

@Component({
  selector: "app-api-key-add",
  templateUrl: "./api-key-add.component.html",
  styleUrls: ["./api-key-add.component.scss"]
})
export class ApiKeyAddComponent implements OnInit {
  @ViewChild("toolbar", {static: true}) toolbar: TemplateRef<any>;
  public apiKey: ApiKey = emptyApiKey();

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private apiKeyService: MockService
  ) {}

  ngOnInit() {
    this.activatedRoute.params
      .pipe(
        filter(params => params.id),
        switchMap(params => this.apiKeyService.get(params.id)),
        take(1)
      )
      .subscribe(apiKey => {
        this.apiKey = apiKey;
      });
  }

  saveApiKey() {
    (this.apiKey._id
      ? this.apiKeyService.update(this.apiKey)
      : this.apiKeyService.insert(this.apiKey)
    )
      .toPromise()
      .then(() => this.router.navigate(["passport/api-key"]))
      .catch(error => console.log(error));
  }
}
