import {Component, OnInit} from "@angular/core";
import {AssetService} from "@spica-client/asset/services/asset.service";
import {Asset} from "@spica-client/asset/interfaces";
import {Observable} from "rxjs";
import {MatDialog} from "@angular/material/dialog";
import {AssetInstallDialog} from "@spica-client/asset/components/install/install.component";

@Component({
  selector: "asset-index",
  templateUrl: "./index.component.html",
  styleUrls: ["./index.component.scss"]
})
export class IndexComponent implements OnInit {
  displayedColumns = ["id", "name", "status", "actions"];

  assets$: Observable<Asset[]>;

  constructor(private assetService: AssetService, private dialog: MatDialog) {}

  ngOnInit(): void {
    this.assets$ = this.assetService.find();
  }

  onInstall(asset: Asset) {
    this.dialog.open(AssetInstallDialog, {
      width: "400px",
      maxHeight: "800px",
      data: {
        asset
      }
    });
  }

  onDelete(asset: Asset, type: "hard" | "soft") {
    // return this.assetService.remove(asset._id);
  }
}
