import {Component, OnInit, TemplateRef, ViewChild, OnDestroy} from "@angular/core";
import {ApiKey, emptyApiKey} from "src/passport/interfaces/apikey";
import {Router, ActivatedRoute} from "@angular/router";
import {filter, switchMap, takeUntil} from "rxjs/operators";
import {apiKeyService} from "src/passport/services/apikey.service";
import {Subject} from "rxjs";

@Component({
  selector: "app-apikey-add",
  templateUrl: "./apikey-add.component.html",
  styleUrls: ["./apikey-add.component.scss"]
})
export class ApiKeyAddComponent implements OnInit, OnDestroy {
  @ViewChild("toolbar", {static: true}) toolbar: TemplateRef<any>;
  public apiKey: ApiKey = emptyApiKey();

  private onDestroy: Subject<void> = new Subject<void>();

  constructor(
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private apiKeyService: apiKeyService
  ) {}

  ngOnInit() {
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
      .then(() => this.router.navigate(["passport/apikey"]))
      .catch(error => console.log(error));
  }

  ngOnDestroy() {
    this.onDestroy.next();
  }
}
