import {Component, OnInit, OnDestroy} from "@angular/core";
import {ActivatedRoute} from "@angular/router";
import {merge, Subscription} from "rxjs";
import {delay, filter, skip, take} from "rxjs/operators";

@Component({
  templateUrl: "./toc.component.html",
  styleUrls: ["./toc.component.scss"],
  host: {
    role: "doc-toc"
  }
})
export class TocComponent implements OnInit, OnDestroy {
  subsctiption: Subscription;

  constructor(private activatedRoute: ActivatedRoute) {}

  ngOnInit() {
    this.subsctiption = merge(
      this.activatedRoute.fragment.pipe(
        take(1),
        delay(500)
      ),
      this.activatedRoute.fragment.pipe(
        skip(1),
        delay(100)
      )
    )
      .pipe(filter(fragment => !!fragment))
      .subscribe(fragment =>
        document
          .getElementById(fragment)
          .scrollIntoView({behavior: "smooth", block: "center", inline: "center"})
      );
  }

  ngOnDestroy(): void {
    this.subsctiption.unsubscribe();
  }
}
