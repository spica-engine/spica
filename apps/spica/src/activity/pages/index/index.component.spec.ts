import {ScrollingModule} from "@angular/cdk/scrolling";
import {ComponentFixture, fakeAsync, TestBed, tick} from "@angular/core/testing";
import {FormsModule} from "@angular/forms";
import {MatButtonModule} from "@angular/material/button";
import {MatCardModule} from "@angular/material/card";
import {MatNativeDateModule, MatOptionModule} from "@angular/material/core";
import {MatDatepickerModule} from "@angular/material/datepicker";
import {MatIconModule} from "@angular/material/icon";
import {MatInputModule} from "@angular/material/input";
import {MatListModule} from "@angular/material/list";
import {MatProgressSpinnerModule} from "@angular/material/progress-spinner";
import {MatSelectModule} from "@angular/material/select";
import {MatTableModule} from "@angular/material/table";
import {MatToolbarModule} from "@angular/material/toolbar";
import {MatTooltipModule} from "@angular/material/tooltip";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {RouterTestingModule} from "@angular/router/testing";
import {BuildLinkPipe} from "@spica-client/common/pipes";
import {BUILDLINK_FACTORY} from "@spica-client/core/factories/factory";
import {of} from "rxjs";
import {ActivityService} from "../../services/activity.service";
import {IndexComponent} from "../index/index.component";
import {MatDividerModule} from "@angular/material/divider";

describe("IndexComponent", () => {
  let component: IndexComponent;
  let fixture: ComponentFixture<IndexComponent>;
  let filterNextSpy: jest.Mock;

  let filters = {
    identifier: "test_identifier",
    action: ["test_action"],
    resource: {
      $all: ["test_name"],
      $in: ["test_documentId"]
    },
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
        MatCardModule,
        MatTableModule,
        MatOptionModule,
        MatSelectModule,
        MatInputModule,
        MatDatepickerModule,
        MatNativeDateModule,
        FormsModule,
        MatButtonModule,
        ScrollingModule,
        MatListModule,
        MatProgressSpinnerModule,
        RouterTestingModule,
        MatTooltipModule,
        MatDividerModule
      ],
      declarations: [IndexComponent, BuildLinkPipe],
      providers: [
        {
          provide: ActivityService,
          useValue: {
            get: () => {
              return of([]);
            },
            checkAllowed: () => {
              return of(true);
            },
            getBuckets: () => {
              return of([{_id: "id1", title: "test_bucket"}]);
            },
            getDocumentIds: () => {}
          }
        },
        {
          provide: BUILDLINK_FACTORY,
          useValue: [],
          multi: true
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(IndexComponent);
    component = fixture.componentInstance;

    fixture.detectChanges();

    await fixture.whenStable();
    fixture.detectChanges();

    filterNextSpy = jest.spyOn(component.filters$, "next");
  });

  it("should set buckets$ ", async () => {
    let buckets = await component.buckets$.toPromise();
    expect(buckets).toEqual([{_id: "id1", title: "test_bucket"}]);
  });

  it("should set buckets$ as empty array if user doesn't have bucket:index access", async () => {
    jest.spyOn(component, "checkAllowed").mockReturnValue(of(false));
    component.ngOnInit();

    let buckets = await component.buckets$.toPromise();
    expect(buckets).toEqual([]);
  });

  it("should apply filters", () => {
    component.filters = filters;
    component.applyFilters();

    expect(component["pageSize"]).toEqual(0);
    expect(filterNextSpy).toHaveBeenCalledTimes(1);
    expect(filterNextSpy).toHaveBeenCalledWith({
      identifier: "test_identifier",
      action: ["test_action"],
      resource: {
        $all: ["test_name"],
        $in: ["test_documentId"]
      },
      date: {
        begin: new Date(2000, 0, 1),
        end: new Date(2000, 0, 1)
      },
      limit: 20,
      skip: 0
    });
  });

  it("should clear filters", () => {
    component.filters = filters;
    component.clearFilters();

    expect(component.documentIds).toBeUndefined();
    expect(component["pageSize"]).toEqual(0);
    expect(filterNextSpy).toHaveBeenCalledTimes(1);
    expect(filterNextSpy).toHaveBeenCalledWith({
      identifier: undefined,
      action: [],
      resource: {$all: [], $in: []},
      date: {
        begin: undefined,
        end: undefined
      },
      limit: 20,
      skip: 0
    });
  });

  it("should get documentIds of selected module which has a group and should set resource filters", fakeAsync(async () => {
    const getDocumentIds = jest.spyOn(component["activityService"], "getDocumentIds").mockReturnValue(
      of(["doc_1", "doc_2"])
    );
    component.onModuleSelectionChange({
      source: {selected: {group: {label: "test_group"}}},
      value: "test_module"
    } as any);

    expect(getDocumentIds).toHaveBeenCalledTimes(1);
    expect(getDocumentIds).toHaveBeenCalledWith("test_group", "test_module");

    tick(1);

    let documentIds = await component.documents$.toPromise();

    expect(documentIds).toEqual(["doc_1", "doc_2"]);
    expect(component.filters.resource.$all).toEqual(["test_group", "test_module"]);
    expect(component.filters.resource.$in).toEqual([]);
  }));

  it("should get documentIds of selected module which doesn't have a group and should set resource filters", fakeAsync(async () => {
    const getDocumentIds = jest.spyOn(component["activityService"], "getDocumentIds").mockReturnValue(
      of(["doc_1", "doc_2"])
    );
    component.onModuleSelectionChange({
      source: {selected: {group: undefined}},
      value: "test_module"
    } as any);

    expect(getDocumentIds).toHaveBeenCalledTimes(1);
    expect(getDocumentIds).toHaveBeenCalledWith("", "test_module");

    tick(1);

    let documentIds = await component.documents$.toPromise();

    expect(documentIds).toEqual(["doc_1", "doc_2"]);
    expect(component.filters.resource.$all).toEqual(["test_module"]);
    expect(component.filters.resource.$in).toEqual([]);
  }));

  it("should set begin and end date", () => {
    let today = new Date();
    let yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    component.setDate(yesterday, today);

    const expectedBegin = new Date(yesterday.setHours(0, 0, 0, 0));
    const expectedEnd = new Date(today.setHours(23, 59, 59, 999));

    expect(component.filters.date).toEqual({begin: expectedBegin, end: expectedEnd});
  });

  it("should fetch next page", () => {
    component.filters = filters;
    component["pageIndex"] = 0;

    component.fetchNextPage();

    expect(component["pageIndex"]).toEqual(1);

    expect(filterNextSpy).toHaveBeenCalledTimes(1);
    expect(filterNextSpy).toHaveBeenCalledWith({
      identifier: "test_identifier",
      action: ["test_action"],
      resource: {
        $all: ["test_name"],
        $in: ["test_documentId"]
      },
      date: {
        begin: new Date(2000, 0, 1),
        end: new Date(2000, 0, 1)
      },
      limit: 20,
      skip: 20
    });
  });
});
