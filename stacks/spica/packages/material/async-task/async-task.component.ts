import {Component, Input, OnChanges, OnDestroy, SimpleChanges, TemplateRef} from "@angular/core";
import {ActivatedRoute} from "@angular/router";
import {merge, Observable, of, Subject} from "rxjs";
import {
  ignoreElements,
  endWith,
  catchError,
  delay,
  map,
  switchMap,
  tap,
  filter,
  takeUntil
} from "rxjs/operators";

@Component({
  selector: "async-task",
  templateUrl: "./async-task.component.html",
  styleUrls: ["./async-task.component.scss"]
})
export class AsyncTaskComponent implements OnChanges, OnDestroy {
  @Input() stateStyles: {
    pristine: {
      icon: string;
      text: string;
    };
    pending: {
      icon?: string;
      text: string;
    };
    succeeded: {
      icon: string;
      text: string;
    };
    failed: {
      icon: string;
      text: string;
    };
  } = {
    pristine: {
      icon: "save",
      text: "Save"
    },
    pending: {
      icon: undefined,
      text: "Saving.."
    },
    succeeded: {
      icon: "done",
      text: "Saved!"
    },
    failed: {
      icon: "clear",
      text: "Failed!"
    }
  };

  @Input() asyncTask: Observable<any> = of(PendingState.Pristine);

  @Input() parent: HTMLButtonElement;

  @Input() minimal = false;

  dispose: Subject<any> = new Subject();

  constructor(private activatedRoute: ActivatedRoute) {
    this.activatedRoute.params
      .pipe(
        filter(params => params.id),
        map(params => params.id),
        takeUntil(this.dispose)
      )
      .subscribe(() => this.reset());
  }

  reset() {
    this.asyncTask = of(PendingState.Pristine);
    if (this.parent) {
      this.parent.disabled = false;
    }
  }

  ngOnChanges(change: SimpleChanges) {
    if (
      (change.asyncTask && change.asyncTask.isFirstChange()) ||
      (change.parent && change.parent.isFirstChange())
    ) {
      return;
    }

    const newAsyncTask = change.asyncTask.currentValue as Observable<any>;

    this.parent.disabled = true;

    this.asyncTask = merge(
      of(PendingState.Pending),
      newAsyncTask
        .pipe(
          ignoreElements(),
          endWith(PendingState.Succeeded),
          catchError(() => of(PendingState.Failed))
        )
        .pipe(
          switchMap(v =>
            merge(
              of(v),
              of(v).pipe(
                delay(1000),
                map(() => PendingState.Pristine),
                tap(() => (this.parent.disabled = false))
              )
            )
          )
        )
    );
  }

  ngOnDestroy() {
    this.dispose.next();
  }
}

export enum PendingState {
  Pristine = "pristine",
  Pending = "pending",
  Succeeded = "succeeded",
  Failed = "failed"
}
