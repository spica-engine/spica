import {Component, OnInit} from "@angular/core";
import {HttpClient} from "@angular/common/http";
import {map} from "rxjs/operators";
import {Observable} from "rxjs";
import {MatIconRegistry} from "@angular/material";
import {DomSanitizer} from "@angular/platform-browser";

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
  constructor(
    http: HttpClient,
    private matIconRegistry: MatIconRegistry,
    private domSanitizer: DomSanitizer
  ) {
    this.matIconRegistry.addSvgIcon(
      "instagram",
      this.domSanitizer.bypassSecurityTrustResourceUrl("../../../assets/icons/social/instagram.svg")
    );
    this.matIconRegistry.addSvgIcon(
      "twitter",
      this.domSanitizer.bypassSecurityTrustResourceUrl("../../../assets/icons/social/twitter.svg")
    );
    this.matIconRegistry.addSvgIcon(
      "facebook",
      this.domSanitizer.bypassSecurityTrustResourceUrl("../../../assets/icons/social/facebook.svg")
    );

    this.matIconRegistry.addSvgIcon(
      "github",
      this.domSanitizer.bypassSecurityTrustResourceUrl("../../../assets/icons/social/github.svg")
    );

    this.$stargazers = http
      .get("https://api.github.com/repos/spica-engine/spica")
      .pipe(map((data: any) => data.stargazers_count));
  }

  ngOnInit() {}
}
