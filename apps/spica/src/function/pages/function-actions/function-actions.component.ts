import {Component, Input, OnInit} from "@angular/core";
import {Subject} from "rxjs";
import {filter, takeUntil} from "rxjs/operators";

import {FunctionService} from "../../services";
import {Function} from "../../interface";
import {Route, RouteCategory} from "@spica-client/core/route";
import {MatLegacyDialog as MatDialog} from "@angular/material/legacy-dialog";
import {ConfigurationComponent} from "@spica-client/function/components/configuration/configuration.component";
import {Router} from "@angular/router";

@Component({
  selector: "function-actions",
  templateUrl: "./function-actions.component.html",
  styleUrls: ["./function-actions.component.scss"]
})
export class FunctionActionsComponent implements OnInit {
  functions: Function[];
  @Input() route: Route;
  private dispose = new Subject();
  categoryStorageKey: string = RouteCategory.Developer;

  constructor(
    private functionService: FunctionService,
    private dialog: MatDialog,
    private router: Router
  ) {}

  ngOnInit() {
    this.functionService
      .getFunctions()
      .pipe(
        takeUntil(this.dispose),
        filter((data: any) => data && data.length)
      )
      .subscribe(data => {
        this.functions = data;
      });
  }

  editFn() {
    this.dialog.open(ConfigurationComponent, {
      data: {
        function: this.functions.find(item => item._id == this.route.id)
      },
      autoFocus: false
    });
  }

  delete(id: string) {
    const index = this.functions.findIndex(b => b._id == id);

    // its copy pasted from bucket, fix the bucket keywords or move this method to the common package
    const currentBucketRoute = this.router.routerState.snapshot.url.split("/")[2];
    let target = currentBucketRoute;

    if (this.functions.length > 1) {
      if (currentBucketRoute == id) {
        const nextIndex = index == 0 ? index + 1 : index - 1;
        target = this.functions[nextIndex]._id;
      }
    } else {
      target = "welcome";
    }

    this.functionService
      .delete(id)
      .toPromise()
      .then(() => target && this.router.navigate(["function", target]));
  }

  ngOnDestroy(): void {
    this.dispose.next();
  }
}
