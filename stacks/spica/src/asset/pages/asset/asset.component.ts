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
  
  constructor(private assetService: AssetService, private activatedRoute: ActivatedRoute) {}

  ngOnInit(): void {
    this.assets$ = this.activatedRoute.params.pipe(
      tap(params => (this.packageName = params.package)),
      switchMap(params => this.assetService.find(params.package))
    );
  }
}
