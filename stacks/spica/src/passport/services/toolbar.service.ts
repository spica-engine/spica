import {Injectable, TemplateRef} from "@angular/core";
import {Subject} from "rxjs";

@Injectable({
  providedIn: "root"
})
export class ToolbarService {
  // Use a Subject to hold the toolbar template
  toolbarTemplate = new Subject<TemplateRef<any>>();
}
