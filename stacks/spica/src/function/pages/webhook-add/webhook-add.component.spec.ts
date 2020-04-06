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
import {MatSlideToggleModule} from "@angular/material/slide-toggle";
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
          MatSlideToggleModule,
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
      getTriggersSpy = spyOn(component["webhookService"], "getCollections").and.callThrough();
      addSpy = spyOn(component["webhookService"], "add").and.callThrough();
      navigateSpy = spyOn(component["router"], "navigate");

      fixture.detectChanges();
      await fixture.whenStable();

      fixture.detectChanges();
    });
    it("should set webhook and trigger", fakeAsync(() => {
      expect(getSpy).toHaveBeenCalledTimes(0);
      expect(getTriggersSpy).toHaveBeenCalledTimes(1);

      expect(component.webhook).toEqual({
        url: undefined,
        trigger: {active: true, name: "database", options: {collection: undefined, type: undefined}}
      });

      tick(1);

      expect(component.trigger).toEqual({
        collections: ["identity", "bucket"],
        types: ["INSERT", "UPDATE", "REPLACE", "DELETE"]
      });
    }));

    it("should enable save button when form fields are valid", async () => {
      const addButton = fixture.debugElement.query(By.css("mat-card mat-card-actions button"));
      const urlInput = fixture.debugElement
        .query(By.css("mat-list mat-list-item:nth-of-type(1) input"))
        .injector.get(NgModel);

      const collectionSelection = fixture.debugElement
        .query(
          By.css("mat-list mat-list-item:nth-of-type(2) mat-form-field:nth-of-type(1) mat-select")
        )
        .injector.get(NgModel);

      const typeSelection = fixture.debugElement
        .query(
          By.css("mat-list mat-list-item:nth-of-type(2)  mat-form-field:nth-of-type(2) mat-select")
        )
        .injector.get(NgModel);

      expect(addButton.nativeElement.disabled).toEqual(true);

      urlInput.control.setValue("http://www.test.com");

      collectionSelection.control.setValue("identity");

      typeSelection.control.setValue("INSERT");

      fixture.detectChanges();

      expect(addButton.nativeElement.disabled).toEqual(false);
    });

    it("should insert webhook and navigate to the webhook-index page", fakeAsync(() => {
      component.webhook = {
        url: "http://www.test.com",
        trigger: {active: true, name: "database", options: {collection: "bucket", type: "DELETE"}}
      };

      component.save();

      tick(1);

      expect(addSpy).toHaveBeenCalledTimes(1);
      expect(addSpy).toHaveBeenCalledWith({
        url: "http://www.test.com",
        trigger: {active: true, name: "database", options: {collection: "bucket", type: "DELETE"}}
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
          MatSlideToggleModule,
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
      getTriggersSpy = spyOn(component["webhookService"], "getCollections").and.callThrough();
      updateSpy = spyOn(component["webhookService"], "update").and.callThrough();
      navigateSpy = spyOn(component["router"], "navigate");

      await component["webhookService"].add({
        url: "http://www.test.com",
        trigger: {active: true, name: "database", options: {collection: "bucket", type: "UPDATE"}}
      });

      fixture.detectChanges();
      await fixture.whenStable();

      fixture.detectChanges();
    });

    it("should set webhook", fakeAsync(() => {
      expect(getSpy).toHaveBeenCalledTimes(1);
      expect(getSpy).toHaveBeenCalledWith("0");

      expect(getTriggersSpy).toHaveBeenCalledTimes(1);

      tick(1);

      expect(component.trigger).toEqual({
        collections: ["identity", "bucket"],
        types: ["INSERT", "UPDATE", "REPLACE", "DELETE"]
      });

      expect(component.webhook).toEqual({
        _id: "0",
        url: "http://www.test.com",
        trigger: {active: true, name: "database", options: {collection: "bucket", type: "UPDATE"}}
      });
    }));

    it("should update webhook then navigate to the webhook-index page", fakeAsync(() => {
      component.save();

      tick(1);

      expect(updateSpy).toHaveBeenCalledTimes(1);
      expect(updateSpy).toHaveBeenCalledWith({
        _id: "0",
        url: "http://www.test.com",
        trigger: {active: true, name: "database", options: {collection: "bucket", type: "UPDATE"}}
      });

      expect(navigateSpy).toHaveBeenCalledTimes(1);
      expect(navigateSpy).toHaveBeenCalledWith(["webhook"]);
    }));
  });
});
