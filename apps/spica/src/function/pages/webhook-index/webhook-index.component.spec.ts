import {ComponentFixture, fakeAsync, TestBed, tick} from "@angular/core/testing";
import {MatCardModule} from "@angular/material/card";
import {MatIconModule} from "@angular/material/icon";
import {MatPaginator, MatPaginatorModule} from "@angular/material/paginator";
import {MatTableModule} from "@angular/material/table";
import {MatToolbarModule} from "@angular/material/toolbar";
import {By} from "@angular/platform-browser";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {RouterTestingModule} from "@angular/router/testing";
import {IndexResult} from "@spica-client/core/interfaces";
import {MatAwareDialogModule} from "@spica-client/material/aware-dialog";
import {of} from "rxjs";
import {Webhook} from "../../interface";
import {WebhookService} from "../../services";
import {WebhookIndexComponent} from "../webhook-index/webhook-index.component";
import {MatButtonModule} from "@angular/material/button";
import {CanInteractDirectiveTest} from "@spica-client/passport/directives/can-interact.directive";
import {MatMenuModule} from "@angular/material/menu";
import {MatCheckboxModule} from "@angular/material/checkbox";
import {MatDividerModule} from "@angular/material/divider";
import {FormsModule} from "@angular/forms";

describe("Webhook Index", () => {
  let fixture: ComponentFixture<WebhookIndexComponent>;
  let webhookService: jest.Mocked<WebhookService>;

  beforeEach(async () => {
    webhookService = {
      'getAll': jest.fn(),
      'delete': jest.fn()
    };
    webhookService.getAll.mockImplementation((limit, skip) => {
      let data = new Array(20).fill(null).map(
        (_, i) =>
          ({
            _id: String(i),
            trigger: {
              name: "database",
              active: true,
              options: {collection: "test_collection", type: "INSERT"}
            },
            body: "",
            url: "test_url",
            title: "test title"
          } as Webhook)
      );

      if (skip) {
        data = data.slice(skip);
      }
      if (limit) {
        data = data.slice(0, limit);
      }
      return of({meta: {total: 20}, data} as IndexResult<Webhook>);
    });

    TestBed.configureTestingModule({
      imports: [
        FormsModule,
        MatPaginatorModule,
        RouterTestingModule,
        MatTableModule,
        MatIconModule,
        MatToolbarModule,
        MatCardModule,
        NoopAnimationsModule,
        MatAwareDialogModule,
        MatButtonModule,
        MatMenuModule,
        MatCheckboxModule,
        MatDividerModule
      ],
      declarations: [WebhookIndexComponent, CanInteractDirectiveTest],
      providers: [
        {
          provide: WebhookService,
          useValue: webhookService
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(WebhookIndexComponent);
    fixture.detectChanges();
  });

  it("should render webhooks", async () => {
    expect(webhookService.getAll).toHaveBeenCalledTimes(1);
    expect(webhookService.getAll).toHaveBeenCalledWith(10, 0, {_id: -1});

    const id = fixture.debugElement.query(By.css("table td:nth-of-type(1)"));
    const title = fixture.debugElement.query(By.css("table td:nth-of-type(2)"));
    const url = fixture.debugElement.query(By.css("table td:nth-of-type(3)"));

    expect(id.nativeElement.textContent).toBe("0");
    expect(url.nativeElement.textContent).toBe("test_url");
    expect(title.nativeElement.textContent).toBe("test title");
  });

  it("should advance to the next page", async () => {
    const paginator = fixture.debugElement
      .query(By.directive(MatPaginator))
      .injector.get(MatPaginator);
    paginator.nextPage();
    fixture.detectChanges();

    expect(webhookService.getAll).toHaveBeenCalledTimes(2);
    expect(webhookService.getAll.mock.calls[1]).toEqual([10, 10, {_id: -1}]);

    const id = fixture.debugElement.query(By.css("table td:nth-of-type(1)"));
    const title = fixture.debugElement.query(By.css("table td:nth-of-type(2)"));
    const url = fixture.debugElement.query(By.css("table td:nth-of-type(3)"));

    expect(id.nativeElement.textContent).toBe("10");
    expect(url.nativeElement.textContent).toBe("test_url");
    expect(title.nativeElement.textContent).toBe("test title");
  });

  it("should delete webhook", fakeAsync(() => {
    webhookService.delete.mockReturnValue(of(null));
    fixture.componentInstance.delete("0");
    tick();
    expect(webhookService.getAll).toHaveBeenCalledTimes(2);
    expect(webhookService.delete).toHaveBeenCalledTimes(1);
    expect(webhookService.delete).toHaveBeenCalledWith("0");
  }));
});
