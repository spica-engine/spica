import {ChangeDetectorRef, Component, Input, OnInit} from "@angular/core";
import * as XLSX from "xlsx";

@Component({
  selector: "table-viewer",
  templateUrl: "./table-viewer.component.html",
  styleUrls: ["./table-viewer.component.scss"]
})
export class TableViewerComponent implements OnInit {
  @Input() content;
  readContent = []

  constructor(private cd: ChangeDetectorRef) {}

  ngOnInit(): void {
    if (!this.content) {
      return;
    }

    switch (this.content.type) {
      case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
        this.readXlsx();
        break;
      case "text/csv":
        this.readCsv();
        break;
    }
  }

  readXlsx() {
    const reader = new FileReader();
    reader.onload = e => {
      const arrayBuffer = e.target.result as ArrayBuffer;
      const workbook = XLSX.read(arrayBuffer, {type: "array"});

      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      this.readContent = XLSX.utils.sheet_to_json(worksheet, {header: 1});

      this.cd.markForCheck();
    };
    reader.readAsArrayBuffer(this.content);
  }

  readCsv() {
    const reader = new FileReader();
    reader.onload = e => {
      const columns = (e.target.result as string).split("\n");
      columns.forEach((c) => {
        const cells = c.split(",");
        this.readContent.push(cells);
      });

      this.cd.markForCheck();
    };
    reader.readAsText(this.content);
  }
}
