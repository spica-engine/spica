import {AfterViewInit, Directive, ElementRef, Input, OnDestroy} from "@angular/core";
import {Observable, Subscription} from "rxjs";
import {distinctUntilChanged, filter, map} from "rxjs/operators";

@Directive({
  selector: "[intersect]",
  exportAs: "intersect"
})
export class IntersectDirective implements OnDestroy, AfterViewInit {
  private subscription: Subscription;
  @Input() wait: boolean = false;
  @Input() single: boolean = false;

  isIntersecting: boolean = false;

  constructor(private element: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    this.subscription = this.observe().subscribe(
      isIntersecting => (this.isIntersecting = isIntersecting)
    );
  }

  private observe() {
    return new Observable<IntersectionObserverEntry[]>(observer => {
      const iobserver = new IntersectionObserver(entry => observer.next(entry), {
        threshold: this.single ? 0.8 : 0.1
      });
      iobserver.observe(this.element.nativeElement);
      return () => iobserver.disconnect();
    }).pipe(
      map(r => r.some(r => r.isIntersecting)),
      distinctUntilChanged(),
      filter(r => r)
    );
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
}
