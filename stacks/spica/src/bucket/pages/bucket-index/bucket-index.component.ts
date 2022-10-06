import {Component, Input, OnDestroy, ViewChild, OnInit} from "@angular/core";
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
import {filter, takeUntil} from "rxjs/operators";
import {ActivatedRoute, Router} from "@angular/router";
import {RouteCategory} from "@spica-client/core/route";

@Component({
  selector: "bucket-index",
  templateUrl: "./bucket-index.component.html",
  styleUrls: ["./bucket-index.component.scss"]
})
export class BucketIndexComponent implements OnDestroy, OnInit {
  @ViewChild(CdkDropListGroup) listGroup: CdkDropListGroup<CdkDropList>;
  @ViewChild(CdkDropList) placeholder: CdkDropList;
  public target: CdkDropList;
  public targetIndex: number;
  public source: CdkDropList;
  public sourceIndex: number;
  public dragIndex: number;
  public activeContainer;
  categoryStorageKey: string = RouteCategory.Content;
  buckets;
  selectedItem: Bucket;
  private dispose = new Subject();
  @Input() sideCar = false;

  constructor(
    private bs: BucketService,
    private viewportRuler: ViewportRuler,
    private router: Router,
    private activatedRoute: ActivatedRoute
  ) {
    this.target = null;
    this.source = null;
    this.bs
      .getBuckets()
      .pipe(filter((data: any) => data && data.length))
      .subscribe(data => {
        this.buckets = data;
      });
  }

  ngOnInit() {
    this.activatedRoute.url.pipe(takeUntil(this.dispose)).subscribe(segments => {
      if (!segments.length) {
        const target = this.buckets.length ? this.buckets[0]._id : "add";
        this.router.navigate(["buckets", target]);
      }
    });
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

  async dropListDropped() {
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
      this.bs.patchIndexes(this.buckets);
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

  delete(bucket: Bucket) {
    const index = this.buckets.findIndex(b => b._id == bucket._id);

    const lastSegment = this.activatedRoute.snapshot.url[
      this.activatedRoute.snapshot.url.length - 1
    ].toString();

    let target = lastSegment;

    if (lastSegment == bucket._id) {
      if (this.buckets.length > 1) {
        const nextIndex = index == 0 ? index + 1 : index - 1;
        target = this.buckets[nextIndex]._id;
      } else {
        target = "welcome";
      }
    }

    this.bs
      .delete(bucket._id)
      .toPromise()
      .then(() => this.router.navigate(["buckets", target]));
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
  updateIndexes(event) {
    Promise.all(event.map(item => this.bs.patchBucket(item.entry_id, item.changes).toPromise()));
  }
}
