import {Component, OnInit} from "@angular/core";
import {ActivatedRoute} from "@angular/router";
import { Asset } from "@spica-client/asset/interfaces";
import {AssetService} from "@spica-client/asset/services/asset.service";
import { Observable, of } from "rxjs";
import {switchMap} from "rxjs/operators";

@Component({
  selector: "app-edit",
  templateUrl: "./edit.component.html",
  styleUrls: ["./edit.component.scss"]
})
export class EditComponent implements OnInit {
  constructor(private route: ActivatedRoute, private assetService: AssetService) {}

  asset$:Observable<Asset> = of()

  ngOnInit(): void {
    this.asset$ = this.route.params.pipe(switchMap(params => this.assetService.findById(params.id)));
  }
}
