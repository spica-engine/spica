import {HttpClientTestingModule} from "@angular/common/http/testing";
import {Directive, HostBinding, Input, Component} from "@angular/core";
import {ComponentFixture, fakeAsync, TestBed, tick} from "@angular/core/testing";
import {FormsModule, NgForm, NgModel} from "@angular/forms";
import {MatCardModule} from "@angular/material/card";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatIconModule} from "@angular/material/icon";
import {MatInputModule} from "@angular/material/input";
import {MatListModule} from "@angular/material/list";
import {MatSelectModule} from "@angular/material/select";
import {MatSlideToggleModule} from "@angular/material/slide-toggle";
import {MatToolbarModule} from "@angular/material/toolbar";
import {By} from "@angular/platform-browser";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {ActivatedRoute} from "@angular/router";
import {RouterTestingModule} from "@angular/router/testing";
import {LayoutModule} from "@spica-client/core/layout";
import {of, Subject} from "rxjs";
import {EditorComponent} from "../../components/editor/editor.component";
import {HandlebarsLanguageDirective} from "../../components/editor/handlebars.language";
import {Webhook} from "../../interface";
import {WebhookService} from "../../webhook.service";
import {WebhookAddComponent} from "./webhook-add.component";
import {MatProgressSpinnerModule} from "@angular/material/progress-spinner";
import {MatSaveModule} from "@spica-client/material";
import {MatButtonModule} from '@angular/material/button';


@Directive({selector: "[canInteract]"})
export class CanInteractDirectiveTest {
  @HostBinding("style.visibility") _visible = "visible";
  @Input("canInteract") action: string;
}

describe("Webhook", () => {
  let fixture: ComponentFixture<WebhookAddComponent>;
  let navigateSpy: jasmine.Spy;
  let webhookService: jasmine.SpyObj<WebhookService>;
  let activatedRoute: Subject<unknown>;

  beforeEach(async () => {
    webhookService = jasmine.createSpyObj("WebhookService", [
      "getCollections",
      "get",
      "add",
      "update"
    ]);
    activatedRoute = new Subject();

    TestBed.configureTestingModule({
      imports: [
        RouterTestingModule,
        MatIconModule,
        MatToolbarModule,
        FormsModule,
        MatFormFieldModule,
        MatListModule,
        MatSelectModule,
        MatButtonModule,
        MatCardModule,
        MatInputModule,
        MatSlideToggleModule,
        NoopAnimationsModule,
        LayoutModule,
        HttpClientTestingModule,
        MatProgressSpinnerModule,
        MatSaveModule
      ],
      declarations: [
        WebhookAddComponent,
        EditorComponent,
        HandlebarsLanguageDirective,
        CanInteractDirectiveTest
      ],
      providers: [
        {
          provide: WebhookService,
          useFactory: () => webhookService
        },
        {
          provide: ActivatedRoute,
          useValue: {
            params: activatedRoute
          }
        }
      ]
    });

    fixture = TestBed.createComponent(WebhookAddComponent);

    navigateSpy = spyOn(fixture.componentInstance["router"], "navigate");

    fixture.detectChanges();
  });

  describe("Add", () => {
    it("should set webhook and trigger", fakeAsync(() => {
      expect(webhookService.get).not.toHaveBeenCalled();
      expect(webhookService.getCollections).toHaveBeenCalledTimes(1);
      expect(fixture.componentInstance.webhook).toBeTruthy();
    }));

    it("should enable save button when form fields are valid", fakeAsync(() => {
      fixture.detectChanges();
      const addButton = fixture.debugElement.query(By.css("mat-card mat-card-actions button"));
      const form = fixture.debugElement.query(By.directive(NgModel)).injector.get(NgForm);
      expect(addButton.nativeElement.disabled).toEqual(true);

      form.setValue({
        url: "http://www.test.com",
        body: "{{{toJSON this}}}",
        collection: "identity",
        type: "INSERT",
        status: true
      });
      fixture.detectChanges();

      expect(addButton.nativeElement.disabled).toEqual(false);
    }));

    it("should insert webhook and navigate to the webhook page", fakeAsync(() => {
      fixture.componentInstance.webhook = {
        url: "http://www.test.com",
        body: "",
        trigger: {active: true, name: "database", options: {collection: "bucket", type: "DELETE"}}
      };
      fixture.detectChanges(false);

      webhookService.add.and.returnValue(of({...fixture.componentInstance.webhook, _id: "1"}));
      const addButton = fixture.debugElement.query(By.css("mat-card mat-card-actions button"));
      addButton.triggerEventHandler("click", {});

      expect(webhookService.add).toHaveBeenCalledTimes(1);
      expect(webhookService.add).toHaveBeenCalledWith({
        url: "http://www.test.com",
        body: "",
        trigger: {active: true, name: "database", options: {collection: "bucket", type: "DELETE"}}
      });

      tick();
      fixture.detectChanges(false);

      tick(1000);
      fixture.detectChanges(false);

      expect(navigateSpy).toHaveBeenCalledTimes(1);
      expect(navigateSpy).toHaveBeenCalledWith(["webhook/1"]);
    }));
  });

  describe("Edit", () => {
    let hook: Webhook = {
      _id: "1",
      body: "",
      url: "http://www.test.com",
      trigger: {active: true, name: "database", options: {collection: "bucket", type: "UPDATE"}}
    };

    beforeEach(() => {
      webhookService.get.and.returnValue(of(hook));
      activatedRoute.next({id: "1"});
    });

    it("should get webhook", fakeAsync(() => {
      expect(webhookService.get).toHaveBeenCalledTimes(1);
      expect(webhookService.get).toHaveBeenCalledWith("1");
      expect(fixture.componentInstance.webhook).toEqual(hook);
    }));

    it("should update webhook", fakeAsync(async () => {
      webhookService.update.and.returnValue(
        of({
          _id: "1",
          body: "updated_webhook",
          url: "http://www.test.com",
          trigger: {active: true, name: "database", options: {collection: "bucket", type: "UPDATE"}}
        })
      );
      const editButton = fixture.debugElement.query(By.css("mat-card mat-card-actions button"));
      editButton.triggerEventHandler("click", {});
      tick();

      expect(webhookService.update).toHaveBeenCalledTimes(1);
      expect(webhookService.update).toHaveBeenCalledWith(hook);

      tick();
      //cause of ExpressionChangedAfterItHasBeenCheckedError
      fixture.detectChanges(false);

      tick(1000);
      fixture.detectChanges(false);

      expect(fixture.componentInstance.webhook).toEqual({
        _id: "1",
        body: "updated_webhook",
        url: "http://www.test.com",
        trigger: {active: true, name: "database", options: {collection: "bucket", type: "UPDATE"}}
      });
    }));
  });
});
