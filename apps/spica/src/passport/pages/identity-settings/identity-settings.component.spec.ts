import {ComponentFixture, fakeAsync, TestBed, tick} from "@angular/core/testing";
import {FormsModule, NgModel} from "@angular/forms";
import {MatCheckboxModule} from "@angular/material/checkbox";
import {MatCardModule} from "@angular/material/card";
import {MatExpansionModule} from "@angular/material/expansion";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatIconModule} from "@angular/material/icon";
import {MatInputModule} from "@angular/material/input";
import {MatLegacyListModule as MatListModule} from "@angular/material/legacy-list";
import {MatLegacyMenuModule as MatMenuModule} from "@angular/material/legacy-menu";
import {MatSelectModule} from "@angular/material/select";
import {MatToolbarModule} from "@angular/material/toolbar";
import {By} from "@angular/platform-browser";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {ActivatedRoute, RouterModule} from "@angular/router";
import {InputModule} from "@spica-client/common";
import {PropertyKvPipe} from "@spica-client/common/pipes";
import {of} from "rxjs";
import {PreferencesService} from "../../../../packages/core/preferences/preferences.service";
import {IdentityService} from "../../services/identity.service";
import {IdentitySettingsComponent} from "./identity-settings.component";

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
            match: "keyword1"
          },
          {
            type: "number",
            match: "keyword2"
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
                  title: "title"
                },
                prop2: {
                  type: "string",
                  readOnly: false
                }
              }
            }
          }
        })
      ),
      replaceOne: null,
      insertOne: null
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
      ).toContain("mat-checkbox-checked", "this should be checked if this property is readonly");
      expect(
        document.body.querySelector("div.mat-menu-item:nth-child(2) mat-checkbox").classList
      ).toContain("mat-checkbox-checked", "this should be checked if this property is required");
    }));

    it("should define input placer area of prop1", () => {
      expect(
        fixture.debugElement.query(By.css("span.input-placer-area")).injector.get(NgModel).value
      ).toEqual({
        default: "something default",
        type: "string",
        readOnly: true,
        title: "title"
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

      expect(fixture.componentInstance.preferences.identity.attributes.properties).toEqual({
        prop1: {
          default: "something default",
          type: "string",
          readOnly: true,
          title: "title"
        }
      });
    });

    it("should save identity", fakeAsync(() => {
      const replaceOneSpy = spyOn(
        fixture.componentInstance["preferencesService"],
        "replaceOne"
      ).and.returnValue(of(null));
      const navigateSpy = spyOn(fixture.componentInstance["router"], "navigate");

      fixture.debugElement.query(By.css("mat-card-actions button")).nativeElement.click();
      tick();
      fixture.detectChanges();

      expect(replaceOneSpy).toHaveBeenCalledTimes(1);
      expect(navigateSpy).toHaveBeenCalledTimes(1);
      expect(navigateSpy).toHaveBeenCalledWith(["/passport/identity"]);
    }));
  });
});
