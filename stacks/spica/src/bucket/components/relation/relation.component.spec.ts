import {TestBed, ComponentFixture, tick, fakeAsync, async} from "@angular/core/testing";
import {RelationComponent} from "./relation.component";
import {MatIconModule, MatTableModule, MatPaginatorModule, MatMenuModule} from "@angular/material";
import {INPUT_SCHEMA, EMPTY_INPUT_SCHEMA} from "@spica-server/common";
import {BucketDataService} from "src/bucket/services/bucket-data.service";
import {of} from "rxjs";
import {PreferencesService} from "@spica-server/core";
import {BucketService} from "src/bucket";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {emptyBucket} from "src/bucket/interfaces/bucket";
import {By} from "@angular/platform-browser";
import {tap} from "rxjs/operators";

describe("Relation Component", () => {
  let fixture: ComponentFixture<RelationComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        NoopAnimationsModule,
        MatIconModule,
        MatTableModule,
        MatPaginatorModule,
        MatMenuModule
      ],
      providers: [
        {
          provide: INPUT_SCHEMA,
          useValue: EMPTY_INPUT_SCHEMA
        },
        {
          provide: BucketDataService,
          useValue: {
            find: jasmine.createSpy("find").and.returnValue(
              of({
                meta: {total: 2},
                data: [
                  {
                    _id: "test1",
                    _schedule: new Date(2000),
                    key: "value1"
                  },
                  {
                    _id: "test2",
                    _schedule: new Date(2000),
                    key: "value2"
                  }
                ]
              })
            ),
            findOne: jasmine.createSpy("findOne").and.returnValue(
              of({
                _id: "test1",
                _schedule: new Date(2000),
                key: "value1"
              })
            )
          }
        },
        {
          provide: PreferencesService,
          useValue: {
            get: jasmine.createSpy("get").and.returnValue(
              of({
                _id: "id1",
                scope: "scope",
                key: "value"
              })
            )
          }
        },
        {
          provide: BucketService,
          useValue: {
            getBucket: jasmine.createSpy("getBucket").and.returnValue(of(emptyBucket()))
          }
        }
      ],
      declarations: [RelationComponent]
    }).compileComponents();
    fixture = TestBed.createComponent(RelationComponent);
    fixture.detectChanges();
  });

  it("should render component", () => {
    expect(fixture.debugElement.query(By.css("button")).nativeElement.textContent).toBe(
      "view_stream Select a New Bucket\n",
      "should work if bucket icon and title rendered correctly"
    );

    expect(fixture.componentInstance.paginator.length).toBe(
      2,
      "should work if bucket.meta.total value is 2 "
    );
  });

  it("should select row", () => {
    const fetchSpy = spyOn(fixture.componentInstance, "_fetchRow").and.callThrough();

    fixture.debugElement.query(By.css("button")).nativeElement.click();
    expect(
      fixture.debugElement.query(By.css("mat-table mat-header-cell")).nativeElement.textContent
    ).toBe(" title ", "should work if bucket.properties.title value rendered correctly");
    fixture.detectChanges();

    fixture.debugElement.queryAll(By.css("mat-table mat-cell button"))[0].nativeElement.click();
    fixture.detectChanges();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith("test1");

    fixture.componentInstance.$row.toPromise().then(value => {
      expect(value).toEqual({
        _id: "test1",
        _schedule: new Date(2000),
        key: "value1"
      });
    });
  });
});
