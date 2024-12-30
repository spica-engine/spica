import {Component, OnInit} from "@angular/core";
import {MatLegacyDialog as MatDialog} from "@angular/material/legacy-dialog";
import {ActivatedRoute, Router} from "@angular/router";
import {AddDirectoryDialog} from "@spica-client/storage/components/add-directory-dialog/add-directory-dialog.component";
import {RootDirService} from "@spica-client/storage/services/root.dir.service";
import {filter, map, tap} from "rxjs/operators";

@Component({
  selector: "app-welcome",
  templateUrl: "./welcome.component.html",
  styleUrls: ["./welcome.component.scss"]
})
export class WelcomeComponent implements OnInit {
  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private rootDirService: RootDirService,
    public dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if (params.openDialog) {
        this.openDialog();
      }
    });
  }

  openDialog() {
    return this.rootDirService
      .findAll()
      .toPromise()
      .then(objects => {
        const existingNames = objects.map(o => {
          return o.name.replace("/", "");
        });

        const dialogRef = this.dialog.open(AddDirectoryDialog, {
          width: "500px",
          data: {
            existingNames,
            type: "directory"
          }
        });

        dialogRef.afterClosed().subscribe(name => {
          if (name) {
            this.rootDirService
              .add(`${name}/`)
              .toPromise()
              .then(() => this.router.navigate(["../", "storage", name]));
          }
        });
      });
  }
}
