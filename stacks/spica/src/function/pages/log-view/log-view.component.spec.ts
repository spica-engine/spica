import {LogViewComponent} from "./log-view.component";
import {ComponentFixture, TestBed, tick, fakeAsync} from "@angular/core/testing";
import {ActivatedRoute, Router} from "@angular/router";
import {of} from "rxjs";
import {FunctionService} from "../../function.service";
import {ScrollingModule} from "@angular/cdk/scrolling";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {FormsModule} from "@angular/forms";
import {MatExpansionModule} from "@angular/material/expansion";
import {MatCardModule} from "@angular/material/card";
import {MatOptionModule} from "@angular/material/core";
import {MatIconModule} from "@angular/material/icon";
import {MatInputModule} from "@angular/material/input";
import {MatProgressSpinnerModule} from "@angular/material/progress-spinner";
import {MatSelectModule} from "@angular/material/select";
import {MatToolbarModule} from "@angular/material/toolbar";
import {MatDatepickerModule} from "@angular/material/datepicker";
import {MatNativeDateModule} from "@angular/material/core";
import {MatSlideToggleModule} from "@angular/material/slide-toggle";
import {take} from "rxjs/operators";

describe("LogViewComponent", () => {
  let fixture: ComponentFixture<LogViewComponent>;

  let now = new Date();

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [
        NoopAnimationsModule,
        MatIconModule,
        MatToolbarModule,
        MatOptionModule,
        MatSelectModule,
        MatCardModule,
        MatInputModule,
        FormsModule,
        ScrollingModule,
        MatProgressSpinnerModule,
        MatExpansionModule,
        MatSlideToggleModule,
        MatDatepickerModule,
        //tests fails without it
        MatNativeDateModule
      ],
      declarations: [LogViewComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: of({
              showErrors: "false",
              function: "fn_id",
              limit: undefined,
              begin: now.toString(),
              end: now.toString()
            })
          }
        },
        {
          provide: FunctionService,
          useValue: {
            getFunctions: () => {
              return of([{_id: "fn_id", name: "test"}]);
            },
            getLogs: () => {
              return of([
                {
                  _id: "1",
                  function: "fn_id",
                  channel: "stdout",
                  created_at: now,
                  content: "log_content"
                }
              ]);
            },
            clearLogs: () => {
              return of(undefined);
            }
          }
        },
        {
          provide: Router,
          useValue: {
            navigate: () => {}
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LogViewComponent);
    fixture.detectChanges();

    await fixture.whenStable();
    fixture.detectChanges();
  });

  it("should map filter", () => {
    fixture.componentInstance.queryParams.pipe(take(1)).subscribe(filter =>
      expect(filter).toEqual({
        showErrors: false,
        function: ["fn_id"],
        limit: 20,
        begin: new Date(now.toString()),
        end: new Date(now.toString())
      })
    );
  });

  it("should map logs", () => {
    let id = "5e0bb6d00000000000000000";
    let mappedLogs = fixture.componentInstance.mapLogs(
      [
        {
          _id: id,
          channel: "stderr",
          content: "content",
          created_at: "",
          event_id: "new_event",
          function: "fn1"
        }
      ],
      [{_id: "fn1", name: "function_name"} as any]
    );

    expect(mappedLogs).toEqual([
      {
        _id: id,
        channel: "stderr",
        content: "content",
        created_at: new Date("2019-12-31T21:00:00.000Z").toString(),
        event_id: "new_event",
        function: "function_name"
      }
    ]);
  });

  it("should clear logs", () => {
    let clearSpy = spyOn(fixture.componentInstance["fs"], "clearLogs");
    fixture.componentInstance.clearLogs();
    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(clearSpy).toHaveBeenCalledWith("fn_id");
  });

  it("should navigate with new filter params", fakeAsync(async () => {
    let navigateSpy = spyOn(fixture.componentInstance.router, "navigate");
    fixture.componentInstance.next({showErrors: true});
    expect(fixture.componentInstance["pageSize"]).toEqual(1);
    expect(navigateSpy).toHaveBeenCalledTimes(1);
    expect(navigateSpy).toHaveBeenCalledWith([], {
      queryParams: {showErrors: true},
      queryParamsHandling: "merge"
    });
  }));

  it("should format hours", () => {
    let formattedHours = fixture.componentInstance.formatHours({begin: now, end: now});
    expect(formattedHours).toEqual({
      begin: new Date(now.setHours(0, 0, 0, 0)),
      end: new Date(now.setHours(23, 59, 59, 999))
    });
  });

  it("should next page", () => {
    let navigateSpy = spyOn(fixture.componentInstance.router, "navigate");
    fixture.componentInstance.fetchNextPage();
    expect(fixture.componentInstance["pageIndex"]).toEqual(2);
    expect(navigateSpy).toHaveBeenCalledTimes(1);
    expect(navigateSpy).toHaveBeenCalledWith([], {
      queryParams: {limit: 40},
      queryParamsHandling: "merge"
    });
  });
});
