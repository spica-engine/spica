import {TestBed, ComponentFixture, tick, fakeAsync, flushMicrotasks} from "@angular/core/testing";
import {IdentitySettingsComponent} from "./identity-settings.component";
import {PreferencesService} from "../../../../packages/core/preferences/preferences.service";
import {of} from "rxjs";
import {ActivatedRoute, RouterModule} from "@angular/router";
import {IdentityService} from "../../services/identity.service";
import {
  MatIconModule,
  MatToolbarModule,
  MatCardModule,
  MatExpansionModule,
  MatMenuModule,
  MatCheckboxModule,
  MatInputModule
} from "@angular/material";
import {PropertyKvPipe} from "../../../../packages/common/property_keyvalue.pipe";
import {FormsModule, NgModel} from "@angular/forms";
import {InputModule} from "@spica-server/common";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatSelectModule} from "@angular/material/select";
import {MatListModule} from "@angular/material/list";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {By} from "@angular/platform-browser";

describe("Identity Setting Component", () => {
  let fixture: ComponentFixture<IdentitySettingsComponent>;

  let preferencesService: jasmine.SpyObj<Partial<PreferencesService>>,
    identityService: jasmine.SpyObj<Partial<IdentityService>>;

  beforeEach(async () => {
    identityService = {
      getPredefinedDefaults: jasmine.createSpy("getPredefinedDefaults").and.returnValue(
        of([
          {
            type: "string",
            keyword: "keyword1"
          },
          {
            type: "number",
            keyword: "keyword2"
          }
        ])
      )
    };
    preferencesService = {
      get: jasmine.createSpy("get").and.returnValue(
        of({
          _id: "123",
          scope: "scope",
          identity: {
            attributes: {
              required: ["prop1"],
              properties: {
                prop1: {
                  default: "something default",
                  type: "string",
                  readOnly: true,
                  title: "title",
                  options: {
                    visible: true
                  }
                },
                prop2: {
                  type: "string",
                  readOnly: false,
                  options: {
                    visible: true
                  }
                }
              }
            }
          }
        })
      ),
      update: null
    };
    TestBed.configureTestingModule({
      imports: [
        RouterModule.forRoot([]),
        MatIconModule,
        MatToolbarModule,
        MatMenuModule,
        MatCardModule,
        MatCheckboxModule,
        FormsModule,
        MatExpansionModule,
        InputModule,
        MatFormFieldModule,
        MatSelectModule,
        MatListModule,
        MatInputModule,
        NoopAnimationsModule
      ],
      providers: [
        {
          provide: PreferencesService,
          useValue: preferencesService
        },
        {
          provide: ActivatedRoute,
          useValue: {
            params: of({
              id: "id1"
            })
          }
        }
      ],
      declarations: [IdentitySettingsComponent, PropertyKvPipe]
    });
    TestBed.overrideProvider(IdentityService, {
      useValue: identityService
    });

    fixture = TestBed.createComponent(IdentitySettingsComponent);
    fixture.detectChanges();

    await fixture.whenStable();
    fixture.detectChanges();
  });

  describe("basic behaviours", () => {
    it("should show title and button", () => {
      expect(
        fixture.debugElement.query(
          By.css(
            "mat-list-item:first-of-type mat-expansion-panel:first-of-type mat-panel-title span"
          )
        ).nativeElement.textContent
      ).toBe("Title");

      expect(
        fixture.debugElement.query(By.css("mat-list-item.property button")).nativeElement.disabled
      ).toBe(true);
    });

    it("should show settings of prop1", fakeAsync(() => {
      fixture.debugElement
        .query(By.css("mat-list-item:first-of-type mat-expansion-panel:first-of-type mat-menu"))
        .nativeElement.click();

      tick();
      fixture.detectChanges();

      expect(
        document.body.querySelector("div.mat-menu-item:nth-child(1) mat-checkbox").classList
      ).toContain("mat-checkbox-checked", "this should be checked if this property is visible");
      expect(
        document.body.querySelector("div.mat-menu-item:nth-child(2) mat-checkbox").classList
      ).toContain("mat-checkbox-checked", "this should be checked if this property is readonly");
      expect(
        document.body.querySelector("div.mat-menu-item:nth-child(3) mat-checkbox").classList
      ).toContain("mat-checkbox-checked", "this should be checked if this property is required");
    }));

    it("should define input placer area of prop1", () => {
      expect(
        fixture.debugElement.query(By.css("span.input-placer-area")).injector.get(NgModel).value
      ).toEqual({
        default: "something default",
        type: "string",
        readOnly: true,
        title: "title",
        options: {
          visible: true
        }
      });
    });

    it("should show predefined defaults of prop1", () => {
      const matSelect = fixture.debugElement.query(
        By.css("div.input-defaults mat-form-field mat-select")
      );

      expect(matSelect.injector.get(NgModel).value).toBe(
        "something default",
        "it should be default value"
      );

      matSelect.nativeElement.click();
      fixture.detectChanges();

      expect(document.body.querySelector("mat-option:last-of-type").textContent).toBe(" keyword1 ");
    });
  });

  describe("actions", () => {
    it("should change predefined defaults of prop1", () => {
      fixture.debugElement
        .query(By.css("div.input-defaults mat-form-field mat-select"))
        .nativeElement.click();

      fixture.detectChanges(false);

      (document.body.querySelector("mat-option:last-of-type") as HTMLButtonElement).click();
      fixture.detectChanges(false);

      expect(
        fixture.debugElement
          .query(By.css("div.input-defaults mat-form-field mat-select"))
          .injector.get(NgModel).value
      ).toBe("keyword1");
    });

    it("should add property", () => {
      const input = fixture.debugElement
        .query(By.css("mat-list-item.property mat-form-field input"))
        .injector.get(NgModel).control;
      input.setValue("new value");
      input.markAsTouched();

      fixture.detectChanges();

      fixture.debugElement.query(By.css("mat-list-item.property button")).nativeElement.click();

      fixture.detectChanges();

      expect(
        fixture.componentInstance.preferences.identity.attributes.properties["new value"]
      ).toEqual({
        type: "string",
        title: "new value",
        description: "Description of 'new value'",
        options: {}
      });
    });

    it("should delete prop2", () => {
      fixture.debugElement
        .query(By.css("mat-expansion-panel:nth-child(2) mat-panel-description button:last-of-type"))
        .nativeElement.click();
      fixture.detectChanges();

      console.log(fixture.componentInstance.preferences.identity.attributes.properties);

      expect(fixture.componentInstance.preferences.identity.attributes.properties).toEqual({
        prop1: {
          default: "something default",
          type: "string",
          readOnly: true,
          title: "title",
          options: {
            visible: true
          }
        }
      });
    });

    it("should save identity", fakeAsync(() => {
      const updateSpy = spyOn(
        fixture.componentInstance["preferencesService"],
        "update"
      ).and.returnValue(of(null));
      const navigateSpy = spyOn(fixture.componentInstance["router"], "navigate");

      fixture.debugElement.query(By.css("mat-card-actions button")).nativeElement.click();
      tick();
      fixture.detectChanges();

      expect(updateSpy).toHaveBeenCalledTimes(1);
      expect(navigateSpy).toHaveBeenCalledTimes(1);
      expect(navigateSpy).toHaveBeenCalledWith(["/passport/identity"]);
    }));
  });
});
