import {Component, OnInit, TemplateRef, ViewChild, OnDestroy} from "@angular/core";
import {ApiKey, emptyApiKey} from "src/passport/interfaces/api-key";
import {Router, ActivatedRoute} from "@angular/router";
import {filter, switchMap, takeUntil} from "rxjs/operators";
import {MockService} from "src/passport/services/api-key.service";
import {Subject} from "rxjs";

@Component({
  selector: "app-api-key-add",
  templateUrl: "./api-key-add.component.html",
  styleUrls: ["./api-key-add.component.scss"]
})
export class ApiKeyAddComponent implements OnInit, OnDestroy {
  @ViewChild("toolbar", {static: true}) toolbar: TemplateRef<any>;
  public apiKey: ApiKey = emptyApiKey();

  private onDestroy: Subject<void> = new Subject<void>();

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private apiKeyService: MockService
  ) {}

  ngOnInit() {
    this.getApiKeyFromId();
  }

  getApiKeyFromId() {
    this.activatedRoute.params
      .pipe(
        filter(params => params.id),
        switchMap(params => this.apiKeyService.get(params.id)),
        takeUntil(this.onDestroy)
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

  ngOnDestroy() {
    this.onDestroy.next();
  }
}
