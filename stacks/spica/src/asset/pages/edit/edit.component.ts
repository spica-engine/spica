import {Component, OnInit} from "@angular/core";
import {ActivatedRoute} from "@angular/router";
import {Asset} from "@spica-client/asset/interfaces";
import {AssetService} from "@spica-client/asset/services/asset.service";
import {Observable, of} from "rxjs";
import {filter, switchMap, tap} from "rxjs/operators";
import {ICONS} from "@spica-client/material";
import {NestedTreeControl} from "@angular/cdk/tree";
import {MatTreeNestedDataSource} from "@angular/material/tree";

interface AssetNode {
  name: string;
  children?: AssetNode[];
}

@Component({
  selector: "app-edit",
  templateUrl: "./edit.component.html",
  styleUrls: ["./edit.component.scss"]
})
export class EditComponent {
  constructor(private route: ActivatedRoute, private assetService: AssetService) {
    this.route.params
      .pipe(
        switchMap(params => this.assetService.findById(params.id)),
        filter(asset => !!asset)
      )
      .subscribe(asset => {
        this.asset = asset;
        this.dataSource = this.categorizeResourcesByModule(asset.resources) as any;
      });
  }

  asset;

  treeControl = new NestedTreeControl<AssetNode>(node => node.children);
  dataSource = new MatTreeNestedDataSource<AssetNode>();

  icons: Array<string> = ICONS;
  readonly iconPageSize = 24;
  visibleIcons: Array<any> = this.icons.slice(0, this.iconPageSize);

  save() {
    
  }

  // categorizeResourcesByModule(resources) {
  //   const categorizedResources = {};

  //   for (const resource of resources) {
  //     categorizedResources[resource.module] = categorizedResources[resource.module] || [];
  //     categorizedResources[resource.module].push(resource);
  //   }

  //   return categorizedResources;
  // }

  buildResourceName(resource) {
    return resource.contents.schema.title || resource.contents.schema.name || resource._id;
  }

  categorizeResourcesByModule(resources) {
    const categorizedResources: AssetNode[] = [];

    for (const resource of resources) {
      let indexOfCategory = categorizedResources.findIndex(c => c.name == resource.module);

      if (indexOfCategory == -1) {
        categorizedResources.push({name: resource.module, children: []});
        indexOfCategory = categorizedResources.length - 1;
      }

      categorizedResources[indexOfCategory].children.push({
        name: this.buildResourceName(resource),
        children: []
      });
    }

    console.log(categorizedResources);

    return categorizedResources;
  }

  hasChild = (_: number, node: AssetNode) => !!node.children && node.children.length > 0;
}
