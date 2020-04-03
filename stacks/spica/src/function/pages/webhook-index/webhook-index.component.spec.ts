import {TestBed, ComponentFixture} from "@angular/core/testing";
import {MatIconModule} from "@angular/material/icon";
import {MatToolbarModule} from "@angular/material/toolbar";
import {MatCardModule} from "@angular/material/card";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {WebhookIndexComponent} from "../webhook-index/webhook-index.component";
import {WebhookService, MockWebkhookService} from "../../webhook.service";
import {MatTableModule} from "@angular/material/table";
import {RouterTestingModule} from "@angular/router/testing";
import {MatPaginatorModule} from "@angular/material/paginator";
import {MatAwareDialogModule} from "@spica-client/material";
import {By} from "@angular/platform-browser";

describe("Webhook Index", () => {
  let fixture: ComponentFixture<WebhookIndexComponent>;
  let component: WebhookIndexComponent;
  let getAllSpy: jasmine.Spy;
  let deleteSpy: jasmine.Spy;
  let refreshSpy: jasmine.Spy;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [
        MatPaginatorModule,
        RouterTestingModule,
        MatTableModule,
        MatIconModule,
        MatToolbarModule,
        MatCardModule,
        NoopAnimationsModule,
        MatAwareDialogModule
      ],
      declarations: [WebhookIndexComponent],
      providers: [
        {
          provide: WebhookService,
          useValue: new MockWebkhookService()
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(WebhookIndexComponent);
    component = fixture.componentInstance;

    getAllSpy = spyOn(component["webhookService"], "getAll").and.callThrough();
    deleteSpy = spyOn(component["webhookService"], "delete").and.callThrough();
    refreshSpy = spyOn(component["refresh"], "next").and.callThrough();

    addWebhooks(20);

    fixture.detectChanges();
    await fixture.whenStable();

    fixture.detectChanges();
  });

  function addWebhooks(count: number) {
    for (let index = 0; index < count; index++) {
      component["webhookService"].add({
        trigger: {type: "test_type", active: true, options: {}},
        url: "test_url"
      });
    }
  }

  it("should render webhooks", async () => {
    expect(getAllSpy).toHaveBeenCalledTimes(1);
    expect(getAllSpy).toHaveBeenCalledWith(10, 0);

    const id = fixture.debugElement.query(By.css("mat-table mat-cell:nth-of-type(1)"));
    const url = fixture.debugElement.query(By.css("mat-table mat-cell:nth-of-type(2)"));

    expect(id.nativeElement.textContent).toBe("0");
    expect(url.nativeElement.textContent).toBe("test_url");
  });

  fit("should navigate to the next page", async () => {
    component["paginator"].nextPage();

    fixture.detectChanges();
    await fixture.whenStable();

    fixture.detectChanges();

    expect(getAllSpy).toHaveBeenCalledTimes(2);
    expect(getAllSpy.calls.argsFor(1)).toEqual([10, 10]);

    const id = fixture.debugElement.query(By.css("mat-table mat-cell:nth-of-type(1)"));
    const url = fixture.debugElement.query(By.css("mat-table mat-cell:nth-of-type(2)"));

    expect(id.nativeElement.textContent).toBe("10");
    expect(url.nativeElement.textContent).toBe("test_url");
  });

  it("should delete webhook", async () => {
    component.delete("0");

    fixture.detectChanges();
    await fixture.whenStable();

    fixture.detectChanges();

    expect(deleteSpy).toHaveBeenCalledTimes(1);
    expect(deleteSpy).toHaveBeenCalledWith("0");

    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });
});
