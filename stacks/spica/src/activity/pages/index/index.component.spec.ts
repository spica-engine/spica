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

import {async, ComponentFixture, TestBed} from "@angular/core/testing";
import {of} from "rxjs";

describe("IndexComponent", () => {
  let component: IndexComponent;
  let fixture: ComponentFixture<IndexComponent>;

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
              return of([
                {
                  action: "test_action",
                  identifier: "test_identifier",
                  resource: {documentId: ["test_document"], name: "test_name"},
                  date: new Date()
                }
              ]);
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
  });

  it("should create", () => {
    expect(component).toBeTruthy();
  });
});
