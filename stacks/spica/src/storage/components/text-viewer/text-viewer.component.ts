import {
  Component,
  Input,
  OnInit,
} from "@angular/core";

@Component({
  selector: "text-viewer",
  templateUrl: "./text-viewer.component.html",
  styleUrls: ["./text-viewer.component.scss"],
})
export class TextViewerComponent implements OnInit {
  @Input() content;

  constructor() {}

  ngOnInit(): void {
    const fileReader = new FileReader();
    fileReader.onload = e => {
      this.content = e.target.result.toString();
    };
    fileReader.readAsText(this.content);
  }
}
