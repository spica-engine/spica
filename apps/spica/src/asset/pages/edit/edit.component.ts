import {Component, OnInit} from "@angular/core";
import {ActivatedRoute} from "@angular/router";
import {Asset, InstallationPreviewByModules, Resource} from "@spica-client/asset/interfaces";
import {AssetService} from "@spica-client/asset/services/asset.service";
import {merge, Observable, of} from "rxjs";
import {catchError, endWith, filter, ignoreElements, switchMap, tap} from "rxjs/operators";
import {ICONS, SavingState} from "@spica-client/material";
import {NestedTreeControl} from "@angular/cdk/tree";
import {MatTreeNestedDataSource} from "@angular/material/tree";
import {displayPreview, separatePreviewResourcesByModule} from "@spica-client/asset/helpers";

interface AssetResourceNode {
  name: string;
  children?: AssetResourceNode[];
  resource?: Resource;
}

@Component({
  selector: "asset-edit",
  templateUrl: "./edit.component.html",
  styleUrls: ["./edit.component.scss"]
})
export class EditComponent {
  $save: Observable<SavingState>;

  preview: InstallationPreviewByModules = {};

  constructor(
    private route: ActivatedRoute,
    private assetService: AssetService
  ) {
    this.route.params
      .pipe(
        tap(() => (this.$save = of(SavingState.Pristine))),
        switchMap(params => this.assetService.findById(params.id)),
        filter(asset => !!asset)
      )
      .subscribe(asset => {
        this.asset = asset;
        this.dataSource = this.categorizeResourcesByModule(asset.resources) as any;
      });
  }

  asset: Asset;

  treeControl = new NestedTreeControl<AssetResourceNode>(node => node.children);
  dataSource = new MatTreeNestedDataSource<AssetResourceNode>();

  save() {
    this.$save = merge(
      of(SavingState.Saving),
      this.assetService.install(this.asset._id, this.asset.configs, false).pipe(
        ignoreElements(),
        endWith(SavingState.Saved),
        catchError(() => of(SavingState.Failed))
      )
    );
  }

  setInstallationPreview() {
    this.assetService
      .install(this.asset._id, this.asset.configs, true)
      .toPromise()
      .then(r => (this.preview = separatePreviewResourcesByModule(r)));
  }

  getResourceName(resource: Resource<any>) {
    return resource.contents.schema.title || resource.contents.schema.name || resource._id;
  }

  categorizeResourcesByModule(resources: Resource<any>[]) {
    const categorizedResources: AssetResourceNode[] = [];

    for (const resource of resources) {
      let indexOfCategory = categorizedResources.findIndex(c => c.name == resource.module);

      if (indexOfCategory == -1) {
        categorizedResources.push({name: resource.module, children: []});
        indexOfCategory = categorizedResources.length - 1;
      }

      categorizedResources[indexOfCategory].children.push({
        name: this.getResourceName(resource),
        children: [],
        resource: resource
      });
    }

    return categorizedResources;
  }

  hasChild = (_: number, node: AssetResourceNode) => !!node.children && node.children.length > 0;
}
