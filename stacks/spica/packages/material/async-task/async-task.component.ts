import {Component, Input, OnChanges, OnDestroy, SimpleChanges, TemplateRef} from "@angular/core";
import {ActivatedRoute} from "@angular/router";
import {iif, merge, Observable, of, Subject} from "rxjs";
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

  @Input() parents: HTMLButtonElement[] = [];

  @Input() minimal = false;

  dispose: Subject<any> = new Subject();

  @Input() skipResponse = false;

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
    this.updateParents(false);
  }

  ngOnChanges(changes: SimpleChanges) {
    let validChange = true;

    for (const [input, change] of Object.entries(changes)) {
      if (
        change.isFirstChange() ||
        (input == "asyncTask" && typeof change.currentValue == "undefined")
      ) {
        validChange = false;
        break;
      }
    }

    if (!validChange) {
      return;
    }

    const newAsyncTask = changes.asyncTask.currentValue as Observable<any>;

    this.updateParents(true);

    this.asyncTask = merge(
      of(PendingState.Pending),
      newAsyncTask
        .pipe(tap(console.log))
        .pipe(
          ignoreElements(),
          endWith(PendingState.Succeeded),
          catchError(() => of(PendingState.Failed))
        )
        .pipe(
          switchMap(v =>
            iif(
              () => this.skipResponse,
              of(PendingState.Pristine).pipe(tap(() => this.updateParents(false))),
              merge(
                of(v),
                of(v).pipe(
                  delay(1000),
                  map(() => PendingState.Pristine),
                  tap(() => this.updateParents(false))
                )
              )
            )
          )
        )
    );
  }

  updateParents(disable: boolean) {
    if (this.parents.length) {
      this.parents.forEach(p => (p.disabled = disable));
    }
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
