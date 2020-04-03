import {ComponentFixture, TestBed, TestBedStatic, tick, fakeAsync} from "@angular/core/testing";
import {WebhookAddComponent} from "./webhook-add.component";
import {WebhookService, MockWebkhookService} from "../../webhook.service";
import {of} from "rxjs";
import {ActivatedRoute} from "@angular/router";
import {RouterTestingModule} from "@angular/router/testing";
import {MatIconModule} from "@angular/material/icon";
import {MatToolbarModule} from "@angular/material/toolbar";
import {FormsModule, NgModel} from "@angular/forms";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatListModule} from "@angular/material/list";
import {MatSelectModule} from "@angular/material/select";
import {InputPlacerComponent} from "@spica/client/packages/common/input";
import {MatCardModule} from "@angular/material/card";
import {Directive, HostBinding, Input} from "@angular/core";
import {MatInputModule} from "@angular/material/input";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {HttpClientTestingModule} from "@angular/common/http/testing";
import {By} from "@angular/platform-browser";

@Directive({selector: "[canInteract]"})
export class CanInteractDirectiveTest {
  @HostBinding("style.visibility") _visible = "visible";
  @Input("canInteract") action: string;
}

describe("Webhook", () => {
  describe("Webhook Add", () => {
    let fixture: ComponentFixture<WebhookAddComponent>;
    let component: WebhookAddComponent;
    let getSpy: jasmine.Spy;
    let getTriggersSpy: jasmine.Spy;
    let addSpy: jasmine.Spy;
    let navigateSpy: jasmine.Spy;

    beforeEach(async () => {
      TestBed.configureTestingModule({
        imports: [
          RouterTestingModule,
          MatIconModule,
          MatToolbarModule,
          FormsModule,
          MatFormFieldModule,
          MatListModule,
          MatSelectModule,
          MatCardModule,
          MatInputModule,
          NoopAnimationsModule,
          HttpClientTestingModule
        ],
        declarations: [WebhookAddComponent, InputPlacerComponent, CanInteractDirectiveTest],
        providers: [
          {
            provide: WebhookService,
            useValue: new MockWebkhookService()
          },
          {
            provide: ActivatedRoute,
            useValue: {
              params: of()
            }
          }
        ]
      }).compileComponents();

      fixture = TestBed.createComponent(WebhookAddComponent);
      component = fixture.componentInstance;

      getSpy = spyOn(component["webhookService"], "get").and.callThrough();
      getTriggersSpy = spyOn(component["webhookService"], "getTriggers").and.callThrough();
      addSpy = spyOn(component["webhookService"], "add").and.callThrough();
      navigateSpy = spyOn(component["router"], "navigate");

      fixture.detectChanges();
      await fixture.whenStable();

      fixture.detectChanges();
    });
    it("should set webhook and trigger", async () => {
      expect(getSpy).toHaveBeenCalledTimes(0);
      expect(getTriggersSpy).toHaveBeenCalledTimes(1);

      expect(component.webhook).toEqual({trigger: {type: undefined, options: {}}, url: undefined});

      const triggers = await component.triggers.toPromise();

      expect(triggers).toEqual({
        handler: "test_handler",
        options: {},
        type: undefined,
        active: true
      });
    });

    it("should enable save button when form fields are valid", async () => {
      const addButton = fixture.debugElement.query(By.css("mat-card mat-card-actions button"));
      const urlInput = fixture.debugElement
        .query(By.css("mat-list mat-list-item:nth-of-type(1) input"))
        .injector.get(NgModel);
      const triggerSelection = fixture.debugElement
        .query(By.css("mat-list mat-list-item:nth-of-type(2) mat-select"))
        .injector.get(NgModel);

      expect(addButton.nativeElement.disabled).toEqual(true);

      urlInput.control.setValue("http://www.asdqwe.com");

      triggerSelection.control.setValue("test_trigger");

      fixture.detectChanges();

      expect(addButton.nativeElement.disabled).toEqual(false);
    });

    it("should insert webhook and navigate to the webhook-index page", fakeAsync(() => {
      component.webhook = {
        trigger: {options: {}, active: true, type: "test_type"},
        url: "test_url"
      };

      component.save();

      tick(1);

      expect(addSpy).toHaveBeenCalledTimes(1);
      expect(addSpy).toHaveBeenCalledWith({
        trigger: {options: {}, active: true, type: "test_type"},
        url: "test_url"
      });

      expect(navigateSpy).toHaveBeenCalledTimes(1);
      expect(navigateSpy).toHaveBeenCalledWith(["webhook"]);
    }));
  });

  describe("Webhook Edit", () => {
    let fixture: ComponentFixture<WebhookAddComponent>;
    let component: WebhookAddComponent;
    let getSpy: jasmine.Spy;
    let getTriggersSpy: jasmine.Spy;
    let updateSpy: jasmine.Spy;
    let navigateSpy: jasmine.Spy;

    beforeEach(async () => {
      TestBed.configureTestingModule({
        imports: [
          RouterTestingModule,
          MatIconModule,
          MatToolbarModule,
          FormsModule,
          MatFormFieldModule,
          MatListModule,
          MatSelectModule,
          MatCardModule,
          MatInputModule,
          NoopAnimationsModule,
          HttpClientTestingModule
        ],
        declarations: [WebhookAddComponent, InputPlacerComponent, CanInteractDirectiveTest],
        providers: [
          {
            provide: WebhookService,
            useValue: new MockWebkhookService()
          },
          {
            provide: ActivatedRoute,
            useValue: {
              params: of({
                id: "0"
              })
            }
          }
        ]
      }).compileComponents();

      fixture = TestBed.createComponent(WebhookAddComponent);
      component = fixture.componentInstance;

      getSpy = spyOn(component["webhookService"], "get").and.callThrough();
      getTriggersSpy = spyOn(component["webhookService"], "getTriggers").and.callThrough();
      updateSpy = spyOn(component["webhookService"], "update").and.callThrough();
      navigateSpy = spyOn(component["router"], "navigate");

      await component["webhookService"].add({
        trigger: {type: "test_type", active: true, options: {}},
        url: "test_url"
      });

      fixture.detectChanges();
      await fixture.whenStable();

      fixture.detectChanges();
    });

    it("should set webhook", async () => {
      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith("0");

      expect(getTriggersSpy).toHaveBeenCalledTimes(1);

      const triggers = await component.triggers.toPromise();

      expect(triggers).toEqual({
        handler: "test_handler",
        options: {},
        type: undefined,
        active: true
      });

      expect(component.webhook).toEqual({
        _id: "0",
        trigger: {type: "test_type", active: true, options: {}},
        url: "test_url"
      });
    });

    it("should update webhook then navigate to the webhook-index page", fakeAsync(() => {
      component.save();

      tick(1);

      expect(updateSpy).toHaveBeenCalledTimes(1);
      expect(updateSpy).toHaveBeenCalledWith({
        _id: "0",
        trigger: {options: {}, active: true, type: "test_type"},
        url: "test_url"
      });

      expect(navigateSpy).toHaveBeenCalledTimes(1);
      expect(navigateSpy).toHaveBeenCalledWith(["webhook"]);
    }));
  });
});
