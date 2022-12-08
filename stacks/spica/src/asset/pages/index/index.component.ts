import {Component, OnInit} from "@angular/core";
import {AssetService} from "@spica-client/asset/services/asset.service";
import {Asset} from "@spica-client/asset/interfaces";
import {Observable} from "rxjs";
import {MatDialog} from "@angular/material/dialog";
import {AssetInstallDialog} from "@spica-client/asset/components/install/install.component";
import {filter, switchMap, tap} from "rxjs/operators";
import {MatAwareDialogComponent} from "@spica-client/material";

@Component({
  selector: "asset-index",
  templateUrl: "./index.component.html",
  styleUrls: ["./index.component.scss"]
})
export class IndexComponent implements OnInit {
  displayedColumns = ["id", "name", "status", "actions"];

  assets$: Observable<Asset[]>;

  constructor(private assetService: AssetService, private dialog: MatDialog) {}

  isPending = false;

  ngOnInit(): void {
    this.assets$ = this.assetService.find();
  }

  onInstall(asset: Asset) {
    const dialogRef = this.dialog.open(AssetInstallDialog, {
      width: "400px",
      maxHeight: "800px",
      data: {
        asset
      }
    });

    dialogRef
      .afterClosed()
      .pipe(
        filter(asset => !!asset),
        tap(() => this.showSpinner()),
        switchMap(asset => this.assetService.install(asset._id, asset.configs, false))
      )
      .toPromise()
      .finally(() => this.hideSpinner());
  }

  onDelete(asset: Asset, type: "hard" | "soft", dialogConfig) {
    const dialogRef = this.dialog.open(MatAwareDialogComponent, {
      data: dialogConfig
    });

    dialogRef
      .afterClosed()
      .pipe(filter(r => !!r))
      .subscribe(() => {
        this.showSpinner();
        this.assetService
          .remove(asset._id, type)
          .toPromise()
          .finally(() => this.hideSpinner());
      });
  }

  showSpinner() {
    this.isPending = true;
  }

  hideSpinner() {
    this.isPending = false;
  }
}
