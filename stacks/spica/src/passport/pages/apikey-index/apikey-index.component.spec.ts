import {ComponentFixture, TestBed} from "@angular/core/testing";
import {ApiKeyIndexComponent} from "./apikey-index.component";
import {
  MatIconModule,
  MatToolbarModule,
  MatCardModule,
  MatTableModule,
  MatPaginatorModule
} from "@angular/material";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {HttpClientTestingModule} from "@angular/common/http/testing";
import {MatAwareDialogModule} from "@spica-client/material";
import {ApiKeyService, MockApiKeyService} from "../../services/apikey.service";
import {RouterTestingModule} from "@angular/router/testing";
import {ApiKey} from "../../interfaces/apikey";
import {By} from "@angular/platform-browser";

describe("ApiKeyIndexComponent", () => {
  let component: ApiKeyIndexComponent;
  let fixture: ComponentFixture<ApiKeyIndexComponent>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [
        MatIconModule,
        MatToolbarModule,
        MatCardModule,
        MatTableModule,
        MatPaginatorModule,
        RouterTestingModule,
        MatAwareDialogModule,
        HttpClientTestingModule,
        NoopAnimationsModule
      ],
      providers: [
        {
          provide: ApiKeyService,
          useValue: new MockApiKeyService()
        }
      ],
      declarations: [ApiKeyIndexComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ApiKeyIndexComponent);
    component = fixture.componentInstance;
    await component["apiKeyService"].insert({
      key: "testkey",
      name: "testname",
      active: true,
      description: "testdescription",
      policies: []
    } as ApiKey);

    fixture.detectChanges();
  });

  it("should show apikeys", () => {
    const cells = fixture.debugElement.queryAll(By.css("mat-table mat-cell"));
    expect(cells[0].nativeElement.textContent).toBe("testkey");
    expect(cells[1].nativeElement.textContent).toBe("testname");
    expect(cells[2].nativeElement.textContent).toBe("testdescription");
  });

  it("should delete apikey", async () => {
    component.deleteApiKey("0");

    await fixture.whenStable();

    const cells = fixture.debugElement.queryAll(By.css("mat-table mat-cell"));
    expect(cells).toEqual([]);
  });
});
