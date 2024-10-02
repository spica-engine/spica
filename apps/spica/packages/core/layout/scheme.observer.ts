import {BreakpointObserver} from "@angular/cdk/layout";
import {Injectable, OnDestroy} from "@angular/core";
import {BehaviorSubject, Observable, Subscription} from "rxjs";
import {map} from "rxjs/operators";

@Injectable()
export class SchemeObserver implements OnDestroy {
  private scheme = new BehaviorSubject<Scheme>(
    this.breakpointObserver.isMatched(Scheme.Dark) ? Scheme.Dark : Scheme.Light
  );

  private breakpointObserverSubs: Subscription;

  constructor(private breakpointObserver: BreakpointObserver) {
    this.breakpointObserverSubs = breakpointObserver.observe(Scheme.Dark).subscribe(state => {
      this.scheme.next(state.matches ? Scheme.Dark : Scheme.Light);
    });
  }

  setScheme(scheme: Scheme) {
    this.scheme.next(scheme);
  }

  isMatched(scheme: Scheme): boolean {
    return this.scheme.value == scheme;
  }

  observe(scheme: Scheme): Observable<boolean> {
    return this.scheme.pipe(map(r => r == scheme));
  }

  ngOnDestroy(): void {
    this.breakpointObserverSubs.unsubscribe();
  }
}

export enum Scheme {
  Dark = "(prefers-color-scheme: dark)",
  Light = "(prefers-color-scheme: light)"
}
