import {Directive, ElementRef, Input, OnDestroy, OnInit, Renderer2} from "@angular/core";
import {Observable, Subscription} from "rxjs";
import {distinctUntilChanged, filter, map, delay, delayWhen} from "rxjs/operators";

@Directive({
  selector: "[intersect]",
  exportAs: "intersect"
})
export class IntersectDirective implements OnDestroy, OnInit {
  private subscription: Subscription;
  @Input() wait: boolean = false;
  @Input() single: boolean = false;
  @Input() intersect: string;

  constructor(private element: ElementRef<HTMLElement>, private renderer: Renderer2) {}

  ngOnInit(): void {
    this.renderer.setProperty(this.element.nativeElement, `@${this.intersect}`, false);
    this.subscription = this.observe().subscribe(r =>
      this.renderer.setProperty(this.element.nativeElement, `@${this.intersect}`, r)
    );
  }

  private observe() {
    return new Observable<IntersectionObserverEntry[]>(observer => {
      const iobserver = new IntersectionObserver(entry => observer.next(entry), {
        threshold: this.single ? 0.8 : 0
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
    this.subscription.unsubscribe();
  }
}
