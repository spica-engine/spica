import {ChangeDetectorRef, Component, Input, OnInit} from "@angular/core";
import * as XLSX from "xlsx";

@Component({
  selector: "xlsx-viewer",
  templateUrl: "./xlsx-viewer.component.html",
  styleUrls: ["./xlsx-viewer.component.scss"]
})
export class XlsxViewerComponent implements OnInit {
  @Input() content;
  readContent;

  constructor(private cd:ChangeDetectorRef) {}

  ngOnInit(): void {
    const reader = new FileReader();
    reader.onload = () => {
      const arrayBuffer = reader.result as ArrayBuffer;
      const workbook = XLSX.read(arrayBuffer, {type: "array"});
      
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
    
      this.readContent = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      this.cd.markForCheck()
      // Use the workbook object to access the sheets and data
    };
    reader.readAsArrayBuffer(this.content);
  }
}
