import {ComponentFixture, TestBed, waitForAsync} from "@angular/core/testing";
import {WebhookLogViewComponent} from "./webhook-log-view.component";
import {WebhookService} from "../../services";
import {MatButtonModule} from "@angular/material/button";
import {MatCardModule} from "@angular/material/card";
import {MatNativeDateModule, MatOptionModule} from "@angular/material/core";
import {MatIconModule} from "@angular/material/icon";
import {MatInputModule} from "@angular/material/input";
import {MatProgressSpinnerModule} from "@angular/material/progress-spinner";
import {MatSelectModule} from "@angular/material/select";
import {MatToolbarModule} from "@angular/material/toolbar";
import {MatDatepickerModule} from "@angular/material/datepicker";
import {ScrollingModule} from "@angular/cdk/scrolling";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {FormsModule} from "@angular/forms";
import {MatExpansionModule} from "@angular/material/expansion";
import {of} from "rxjs";

describe("WebhookLogViewComponent", () => {
  let component: WebhookLogViewComponent;
  let fixture: ComponentFixture<WebhookLogViewComponent>;
  let filterNextSpy: jest.Mock;

  let filter = {
    webhooks: ["test_webhook"],
    succeed: false,
    date: {
      begin: new Date(2000, 0, 1),
      end: new Date(2000, 0, 1)
    },
    limit: 50,
    skip: 50
  };

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
        MatDatepickerModule,
        MatNativeDateModule,
        MatButtonModule,
        ScrollingModule,
        MatProgressSpinnerModule,
        MatExpansionModule
      ],
      declarations: [WebhookLogViewComponent],
      providers: [
        {
          provide: WebhookService,
          useValue: {
            getLogs: () => {
              return of([
                {
                  _id: "1",
                  webhook: "test_webhook",
                  succeed: true,
                  content: {
                    request: {},
                    response: {}
                  },
                  execution_time: new Date()
                }
              ]);
            }
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(WebhookLogViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    await fixture.whenStable();
    fixture.detectChanges();

    filterNextSpy = jest.spyOn(component.filter$, "next");
  });

  it("should apply filter", () => {
    component.filter = filter;
    component.applyFilter();

    expect(component["pageSize"]).toEqual(0);
    expect(filterNextSpy).toHaveBeenCalledTimes(1);
    expect(filterNextSpy).toHaveBeenCalledWith({
      webhooks: ["test_webhook"],
      succeed: false,
      date: {
        begin: new Date(2000, 0, 1),
        end: new Date(2000, 0, 1)
      },
      limit: 20,
      skip: undefined
    });
  });

  it("should clear filters", () => {
    component.filter = filter;
    component.clearFilter();

    expect(component["pageSize"]).toEqual(0);
    expect(filterNextSpy).toHaveBeenCalledTimes(1);
    expect(filterNextSpy).toHaveBeenCalledWith({
      date: {
        begin: undefined,
        end: undefined
      },
      succeed: null,
      webhooks: [],
      limit: 20,
      skip: undefined
    });
  });

  it("should set begin and end date", () => {
    let today = new Date();
    let yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    component.setDate(yesterday, today);

    const expectedBegin = new Date(yesterday.setHours(0, 0, 0, 0));
    const expectedEnd = new Date(today.setHours(23, 59, 59, 999));

    expect(component.filter.date).toEqual({begin: expectedBegin, end: expectedEnd});
  });

  it("should fetch next page", () => {
    component.filter = filter;
    component["pageIndex"] = 0;

    component.fetchNextPage();

    expect(component["pageIndex"]).toEqual(1);

    expect(filterNextSpy).toHaveBeenCalledTimes(1);
    expect(filterNextSpy).toHaveBeenCalledWith({
      webhooks: ["test_webhook"],
      succeed: false,
      date: {
        begin: new Date(2000, 0, 1),
        end: new Date(2000, 0, 1)
      },
      limit: 20,
      skip: 20
    });
  });
});
