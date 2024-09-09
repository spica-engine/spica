import {ComponentFixture, TestBed} from "@angular/core/testing";
import {FormsModule, NgModel} from "@angular/forms";
import {MatButtonModule, MatButton} from "@angular/material/button";
import {MatCardModule} from "@angular/material/card";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatIconModule} from "@angular/material/icon";
import {MatListModule} from "@angular/material/list";
import {MatSelectModule} from "@angular/material/select";
import {MatToolbarModule} from "@angular/material/toolbar";
import {MatTooltip, MatTooltipModule} from "@angular/material/tooltip";
import {By} from "@angular/platform-browser";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {RouterTestingModule} from "@angular/router/testing";
import {PreferencesService} from "@spica-client/core";
import {of} from "rxjs";
import {SettingsComponent} from "./settings.component";
import {MatAwareDialogModule} from "@spica-client/material/aware-dialog";

describe("SettingsComponent", () => {
  let fixture: ComponentFixture<SettingsComponent>;
  let preferenceService;

  beforeEach(() => {
    preferenceService = {
      get: jasmine.createSpy("get").and.returnValue(
        of({
          language: {
            available: {
              tr_TR: "Turkish",
              en_US: "English"
            },
            default: "tr_TR"
          }
        })
      ),
      replaceOne: jasmine.createSpy("replaceOne").and.returnValue(of(null))
    };
    TestBed.configureTestingModule({
      imports: [
        MatToolbarModule,
        MatCardModule,
        MatFormFieldModule,
        MatButtonModule,
        MatTooltipModule,
        MatIconModule,
        MatSelectModule,
        MatListModule,
        RouterTestingModule.withRoutes([
          {
            path: "buckets",
            component: SettingsComponent
          }
        ]),
        NoopAnimationsModule,
        FormsModule,
        MatAwareDialogModule
      ],
      providers: [
        {
          provide: PreferencesService,
          useValue: preferenceService
        }
      ],
      declarations: [SettingsComponent]
    });
    fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();
  });

  it("should render languages", () => {
    expect(
      fixture.debugElement.query(By.css("mat-mdc-list mat-list-item:last-of-type h4")).nativeElement
        .textContent
    ).toBe("Turkish (tr_TR)");
    expect(
      fixture.debugElement.query(By.css("mat-mdc-list mat-list-item:last-of-type mat-icon"))
        .nativeElement.classList
    ).toContain("mat-mdc-warn");
    expect(
      fixture.debugElement
        .query(By.css("mat-mdc-list mat-list-item:last-of-type mat-icon"))
        .injector.get(MatTooltip).disabled
    ).toBe(false);

    expect(
      fixture.debugElement
        .query(By.css("mat-mdc-list mat-list-item:last-of-type button"))
        .injector.get(MatButton).disabled
    ).toBe(true, "should work when default language is immutable");

    expect(
      fixture.debugElement.query(By.css("mat-mdc-list mat-list-item:first-of-type h4"))
        .nativeElement.textContent
    ).toBe("English (en_US)");
    expect(
      fixture.debugElement.query(By.css("mat-mdc-list mat-list-item:first-of-type mat-icon"))
        .nativeElement.classList
    ).not.toContain("mat-mdc-warn");
    expect(
      fixture.debugElement
        .query(By.css("mat-mdc-list mat-list-item:first-of-type mat-icon"))
        .injector.get(MatTooltip).disabled
    ).toBe(true);
    expect(
      fixture.debugElement
        .query(By.css("mat-mdc-list mat-list-item:first-of-type button"))
        .injector.get(MatButton).disabled
    ).toBe(false, "should work when languages are removable except default one");

    expect(preferenceService.get).toHaveBeenCalledTimes(1);
    expect(preferenceService.get).toHaveBeenCalledWith("bucket");
  });

  it("should disable add button if language exists", () => {
    const model = fixture.debugElement.query(By.directive(NgModel)).injector.get(NgModel);
    model.reset("tr_TR");
    fixture.detectChanges();
    expect(
      fixture.debugElement.query(By.css("mat-mdc-card-content > form > button:last-of-type"))
        .nativeElement.disabled
    ).toBe(true);

    model.reset("ar");
    fixture.detectChanges();
    expect(
      fixture.debugElement.query(By.css("mat-mdc-card-content > form > button:last-of-type"))
        .nativeElement.disabled
    ).toBe(false);
  });

  it("should add new language", () => {
    fixture.componentInstance.addLanguage("af");
    fixture.detectChanges();

    expect(
      fixture.debugElement.query(By.css("mat-list mat-list-item:first-of-type h4")).nativeElement
        .textContent
    ).toBe("Afrikaans (af)");
    expect(
      fixture.debugElement.query(By.css("mat-list mat-list-item:first-of-type mat-icon"))
        .nativeElement.classList
    ).not.toContain("mat-warn");
    expect(
      fixture.debugElement
        .query(By.css("mat-list mat-list-item:first-of-type mat-icon"))
        .injector.get(MatTooltip).disabled
    ).toBe(true);
  });

  it("should remove the language", async () => {
    fixture.componentInstance.settings.language.available = {
      tr_TR: "Turkish",
      en_US: "English",
      af: "Afrikaans"
    };

    fixture.componentInstance.remove("af");

    expect(fixture.componentInstance.settings.language).toEqual({
      available: {
        tr_TR: "Turkish",
        en_US: "English"
      },
      default: "tr_TR"
    });
  });

  it("should not remove the default language", async () => {
    fixture.componentInstance.settings.language.available = {
      tr_TR: "Turkish",
      en_US: "English",
      af: "Afrikaans"
    };

    fixture.componentInstance.remove("tr_TR");

    expect(fixture.componentInstance.settings.language).toEqual({
      available: {
        tr_TR: "Turkish",
        en_US: "English",
        af: "Afrikaans"
      },
      default: "tr_TR"
    });
  });

  it("should update settings", () => {
    fixture.componentInstance.addLanguage("af");
    fixture.debugElement.query(By.css("mat-mdc-card-actions button")).nativeElement.click();
    expect(preferenceService.replaceOne).toHaveBeenCalledTimes(1);
    expect(preferenceService.replaceOne).toHaveBeenCalledWith({
      language: {
        available: {
          tr_TR: "Turkish",
          en_US: "English",
          af: "Afrikaans"
        },
        default: "tr_TR"
      }
    });
  });
});
