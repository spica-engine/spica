import {Component, OnInit} from "@angular/core";
import {ActivatedRoute} from "@angular/router";
import {Asset} from "@spica-client/asset/interface";
import {AssetService} from "@spica-client/asset/services/asset.service";
import {Observable, of} from "rxjs";
import {switchMap, tap} from "rxjs/operators";

@Component({
  selector: "asset",
  templateUrl: "./asset.component.html",
  styleUrls: ["./asset.component.scss"]
})
export class AssetComponent implements OnInit {
  assets$: Observable<Asset[]> = of([]);
  packageName: string;
  displayedProperties = ["name", "resource", "created_at"];

  constructor(private assetService: AssetService, private activatedRoute: ActivatedRoute) {}

  ngOnInit(): void {
    this.assets$ = this.activatedRoute.params.pipe(
      tap(params => (this.packageName = params.package)),
      switchMap(params => this.assetService.find(params.package))
    );
  }

  getUrl(asset) {
    const id = asset.metadata.uid;
    const module = asset._id.split("ɵ")[0];
    switch (module) {
      case "bucket":
        return `buckets/${id}`
      case "function":
        return `function/${id}`
      case "passport":
        const subModule = asset._id.split("ɵ")[1]
        return `passport/${subModule}/${id}`
      case "dashboard":
        return `dashboard/${id}`
      default:
        console.warn("Unable to create url of asset")
        console.warn(asset)
        break;
    }
  }
}
