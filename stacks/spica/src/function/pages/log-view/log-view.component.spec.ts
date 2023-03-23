import {ScrollingModule} from "@angular/cdk/scrolling";
import {ComponentFixture, fakeAsync, TestBed} from "@angular/core/testing";
import {FormsModule} from "@angular/forms";
import {MatCardModule} from "@angular/material/card";
import {MatNativeDateModule, MatOptionModule} from "@angular/material/core";
import {MatDatepickerModule} from "@angular/material/datepicker";
import {MatExpansionModule} from "@angular/material/expansion";
import {MatIconModule} from "@angular/material/icon";
import {MatInputModule} from "@angular/material/input";
import {MatProgressSpinnerModule} from "@angular/material/progress-spinner";
import {MatSelectModule} from "@angular/material/select";
import {MatSlideToggleModule} from "@angular/material/slide-toggle";
import {MatToolbarModule} from "@angular/material/toolbar";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {ActivatedRoute} from "@angular/router";
import {RouterTestingModule} from "@angular/router/testing";
import {of} from "rxjs";
import {take} from "rxjs/operators";
import {FunctionService} from "../../services";
import {LogViewComponent} from "./log-view.component";
import {CanInteractDirectiveTest} from "@spica-client/passport/directives/can-interact.directive";

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
        MatNativeDateModule,
        RouterTestingModule
      ],
      declarations: [LogViewComponent, CanInteractDirectiveTest],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            queryParams: of({
              function: "fn_id",
              begin: now.toString(),
              end: now.toString(),
              levels: [0, 1]
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
              return of(true);
            },
            checkRealtimeLogConnectivity: () => {
              return of(true);
            }
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
        function: ["fn_id"],
        begin: new Date(now.toString()),
        end: new Date(now.toString()),
        levels: [0, 1]
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
          function: "fn1",
          level: 0
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
        function: {_id: "fn1", name: "function_name"} as any,
        level: 0
      }
    ]);
  });

  it("should clear logs", () => {
    let clearSpy = spyOn(fixture.componentInstance["fs"], "clearLogs").and.callThrough();
    fixture.componentInstance.clearLogs();
    expect(clearSpy).toHaveBeenCalledTimes(1);
    expect(clearSpy).toHaveBeenCalledWith("fn_id", {
      function: ["fn_id"],
      begin: new Date(now.toString()),
      end: new Date(now.toString()),
      levels: [0, 1]
    } as any);
  });

  it("should navigate with new filter params", fakeAsync(async () => {
    let navigateSpy = spyOn(fixture.componentInstance.router, "navigate");
    fixture.componentInstance.next({showErrors: true});
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
});
