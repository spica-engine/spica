import {Component, OnInit} from "@angular/core";
import {HttpClient} from "@angular/common/http";
import {map} from "rxjs/operators";
import {Observable} from "rxjs";

@Component({
  selector: "app-header",
  templateUrl: "./header.component.html",
  styleUrls: ["./header.component.scss"],
  host: {
    "aria-role": "heading",
    "aria-level": "1"
  }
})
export class HeaderComponent implements OnInit {
  supportMessage: string = "If you like spica\nSupport us with a star ❤";
  $stargazers: Observable<number>;
  constructor(http: HttpClient) {
    this.$stargazers = http
      .get("https://api.github.com/repos/spica-engine/spica")
      .pipe(map((data: any) => data.stargazers_count));
  }

  ngOnInit() {}
}
