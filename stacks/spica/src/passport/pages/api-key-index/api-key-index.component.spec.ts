import {async, ComponentFixture, TestBed, tick, fakeAsync} from "@angular/core/testing";
import {ApiKeyIndexComponent} from "./api-key-index.component";
import {
  MatIconModule,
  MatToolbarModule,
  MatCardModule,
  MatTableModule,
  MatPaginatorModule
} from "@angular/material";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {of} from "rxjs";

import {IndexResult} from "@spica-server/core";
import {MatAwareDialogModule} from "@spica-client/material";
import {MockService} from "../../services/api-key.service";
import {RouterTestingModule} from "@angular/router/testing";
import {ApiKey} from "../../interfaces/api-key";
import {By} from "@angular/platform-browser";

describe("ApiKeyIndexComponent", () => {
  let component: ApiKeyIndexComponent;
  let fixture: ComponentFixture<ApiKeyIndexComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      imports: [
        MatIconModule,
        MatToolbarModule,
        MatCardModule,
        MatTableModule,
        MatPaginatorModule,
        RouterTestingModule,
        MatAwareDialogModule,
        NoopAnimationsModule
      ],
      providers: [
        {
          provide: MockService,
          useValue: {
            getAll: () =>
              of({
                meta: {total: 1},
                data: [
                  {_id: "1", key: "testkey1", name: "testname1", description: "testdescription1"}
                ]
              } as IndexResult<ApiKey>)
          }
        }
      ],
      declarations: [ApiKeyIndexComponent]
    }).compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ApiKeyIndexComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should show apikeys", () => {
    const cells = fixture.debugElement.queryAll(By.css("mat-table mat-cell"));

    expect(cells[0].nativeElement.textContent).toBe("testkey1");
    expect(cells[1].nativeElement.textContent).toBe("testname1");
    expect(cells[2].nativeElement.textContent).toBe("testdescription1");
  });
});
