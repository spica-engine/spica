import {IndexComponent} from "@spica-client/activity/pages/index/index.component";
import {
  MatIconModule,
  MatToolbarModule,
  MatCardModule,
  MatTableModule,
  MatOptionModule,
  MatSelectModule,
  MatInputModule,
  MatButtonModule
} from "@angular/material";
import {ScrollingModule} from "@angular/cdk/scrolling";
import {MatListModule} from "@angular/material/list";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {SatDatepickerModule, SatNativeDateModule} from "saturn-datepicker";
import {FormsModule} from "@angular/forms";
import {MatProgressSpinnerModule} from "@angular/material/progress-spinner";
import {ActivityService} from "../../services/activity.service";

import {ComponentFixture, TestBed, tick, fakeAsync} from "@angular/core/testing";
import {of} from "rxjs";

describe("IndexComponent", () => {
  let component: IndexComponent;
  let fixture: ComponentFixture<IndexComponent>;
  let filterNextSpy: jasmine.Spy;

  let filters = {
    identifier: "test_identifier",
    action: ["test_action"],
    resource: {
      name: "test_name",
      documentId: ["test_documentId"]
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
        SatDatepickerModule,
        SatNativeDateModule,
        FormsModule,
        MatButtonModule,
        ScrollingModule,
        MatListModule,
        MatProgressSpinnerModule
      ],
      declarations: [IndexComponent],
      providers: [
        {
          provide: ActivityService,
          useValue: {
            get: () => {
              return of([]);
            },
            getDocuments: () => {
              return of(["doc_1", "doc_2"]);
            }
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(IndexComponent);
    component = fixture.componentInstance;

    fixture.detectChanges();

    await fixture.whenStable();
    fixture.detectChanges();

    filterNextSpy = spyOn(component.filters$, "next").and.callThrough();
  });

  it("should push buckets to bucket-data group", () => {
    expect(component.moduleGroups[0]).toEqual({
      name: "Bucket-Data",
      modules: ["Bucket_doc_1", "Bucket_doc_2"]
    });
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
        name: "test_name",
        documentId: ["test_documentId"]
      },
      date: {
        begin: new Date(2000, 0, 1),
        end: new Date(2000, 0, 1)
      },
      limit: 20,
      skip: undefined
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
      action: undefined,
      resource: {
        name: undefined,
        documentId: undefined
      },
      date: {
        begin: undefined,
        end: undefined
      },
      limit: 20,
      skip: undefined
    });
  });

  it("should get documentIds of selected module", fakeAsync(() => {
    const getDocumentsSpy = spyOn(component["activityService"], "getDocuments").and.callThrough();
    component.showDocuments("test_module");

    expect(getDocumentsSpy).toHaveBeenCalledTimes(1);
    expect(getDocumentsSpy).toHaveBeenCalledWith("test_module");

    tick(1);

    expect(component.documentIds).toEqual(["doc_1", "doc_2"]);
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
        name: "test_name",
        documentId: ["test_documentId"]
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
