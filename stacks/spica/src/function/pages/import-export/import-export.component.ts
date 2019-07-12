import {Component, OnInit} from "@angular/core";
import {saveAs} from "file-saver";

import {FunctionService} from "../../function.service";
import {Function} from "../../interface";
import {Router} from "@angular/router";

@Component({
  selector: "import-export",
  templateUrl: "./import-export.component.html",
  styleUrls: ["./import-export.component.scss"]
})
export class ImportExportComponent implements OnInit {
  public functions: Function[];
  progressBarImport: boolean = false;
  progressBarExport: boolean = false;
  constructor(private functionService: FunctionService, private router: Router) {}

  ngOnInit() {
    this.functionService.loadFunctions().subscribe(data => (this.functions = data));
  }
  export(functionIds: Array<string>): void {
    this.progressBarExport = true;
    this.functionService.exportData(functionIds).subscribe(data => {
      this.progressBarExport = false;
      saveAs(data, `export.zip`);
    });
  }

  import(file: File): void {
    this.progressBarImport = true;
    this.functionService.importData(file).subscribe(d => {
      if (d.ok == true) {
        this.router.navigate(["function"]);
      }
      this.progressBarImport = false;
    });
  }
}
