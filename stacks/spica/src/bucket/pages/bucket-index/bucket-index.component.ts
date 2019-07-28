import {BreakpointObserver} from "@angular/cdk/layout";
import {Component, OnDestroy, ViewChild} from "@angular/core";
import {Subject} from "rxjs";
import {Bucket} from "../../interfaces/bucket";
import {BucketService} from "../../services/bucket.service";
import {ViewportRuler} from "@angular/cdk/overlay";
import {
  moveItemInArray,
  CdkDropList,
  CdkDropListGroup,
  CdkDragMove,
  CdkDrag
} from "@angular/cdk/drag-drop";

@Component({
  selector: "bucket-index",
  templateUrl: "./bucket-index.component.html",
  styleUrls: ["./bucket-index.component.scss"]
})
export class BucketIndexComponent implements OnDestroy {
  @ViewChild(CdkDropListGroup, {static: false}) listGroup: CdkDropListGroup<CdkDropList>;
  @ViewChild(CdkDropList, {static: false}) placeholder: CdkDropList;
  public target: CdkDropList;
  public targetIndex: number;
  public source: CdkDropList;
  public sourceIndex: number;
  public dragIndex: number;
  public activeContainer;
  buckets = [];
  private dispose = new Subject();

  constructor(
    private bs: BucketService,
    public breakpointObserver: BreakpointObserver,
    private viewportRuler: ViewportRuler
  ) {
    this.target = null;
    this.source = null;
    this.bs.getBuckets().subscribe(data => (this.buckets = data));
  }
  ngAfterViewInit() {
    let phElement = this.placeholder.element.nativeElement;

    phElement.style.display = "none";
    phElement.parentElement.removeChild(phElement);
  }

  dragMoved(e: CdkDragMove) {
    let point = this.getPointerPositionOnPage(e.event);

    this.listGroup._items.forEach(dropList => {
      if (this.__isInsideDropListClientRect(dropList, point.x, point.y)) {
        this.activeContainer = dropList;
        return;
      }
    });
  }

  dropListDropped() {
    if (!this.target) return;

    let phElement = this.placeholder.element.nativeElement;
    let parent = phElement.parentElement;

    phElement.style.display = "none";

    parent.removeChild(phElement);
    parent.appendChild(phElement);
    parent.insertBefore(this.source.element.nativeElement, parent.children[this.sourceIndex]);

    this.target = null;
    this.source = null;

    if (this.sourceIndex != this.targetIndex) {
      moveItemInArray(this.buckets, this.sourceIndex, this.targetIndex);
      this.bs
        .updateMany(this.buckets.map((bucket, index) => ({...bucket, order: index})))
        .toPromise()
        .then(() => this.bs.retrieve().toPromise());
    }
  }

  dropListEnterPredicate = (drag: CdkDrag, drop: CdkDropList) => {
    if (drop == this.placeholder) return true;

    if (drop != this.activeContainer) return false;

    let phElement = this.placeholder.element.nativeElement;
    let sourceElement = drag.dropContainer.element.nativeElement;
    let dropElement = drop.element.nativeElement;

    let dragIndex = this.__indexOf(
      dropElement.parentElement.children,
      this.source ? phElement : sourceElement
    );
    let dropIndex = this.__indexOf(dropElement.parentElement.children, dropElement);

    if (!this.source) {
      this.sourceIndex = dragIndex;
      this.source = drag.dropContainer;

      phElement.style.width = sourceElement.clientWidth + "px";
      phElement.style.height = sourceElement.clientHeight + "px";

      sourceElement.parentElement.removeChild(sourceElement);
    }

    this.targetIndex = dropIndex;
    this.target = drop;

    phElement.style.display = "";
    dropElement.parentElement.insertBefore(
      phElement,
      dropIndex > dragIndex ? dropElement.nextSibling : dropElement
    );

    this.placeholder.enter(
      drag,
      drag.element.nativeElement.offsetLeft,
      drag.element.nativeElement.offsetTop
    );
    return false;
  };

  getPointerPositionOnPage(event: MouseEvent | TouchEvent) {
    const point = this.__isTouchEvent(event) ? event.touches[0] || event.changedTouches[0] : event;
    const scrollPosition = this.viewportRuler.getViewportScrollPosition();

    return {
      x: point.pageX - scrollPosition.left,
      y: point.pageY - scrollPosition.top
    };
  }

  delete(bucket: Bucket): void {
    this.bs.delete(bucket._id).toPromise();
  }

  ngOnDestroy(): void {
    this.dispose.next();
  }

  private __indexOf(collection, node) {
    return Array.prototype.indexOf.call(collection, node);
  }

  private __isTouchEvent(event: MouseEvent | TouchEvent): event is TouchEvent {
    return event.type.startsWith("touch");
  }

  private __isInsideDropListClientRect(dropList: CdkDropList, x: number, y: number) {
    const {top, bottom, left, right} = dropList.element.nativeElement.getBoundingClientRect();
    return y >= top && y <= bottom && x >= left && x <= right;
  }
}
