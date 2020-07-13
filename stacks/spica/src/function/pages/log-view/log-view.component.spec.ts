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

fdescribe("LogViewComponent", () => {
  let component: LogViewComponent;
  let fixture: ComponentFixture<LogViewComponent>;

  let begin = new Date();
  let end = new Date();

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
              begin: begin.toString(),
              end: end.toString()
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
                  created_at: new Date(),
                  content: "log_content"
                }
              ]);
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
    component = fixture.componentInstance;
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
        begin: new Date(begin.toString()),
        end: new Date(end.toString())
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

  xit("should clear logs", () => {
    fixture.componentInstance.clearLogs();
  });
});
