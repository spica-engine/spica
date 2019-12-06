import {ComponentFixture, TestBed} from "@angular/core/testing";
import {FormsModule, NgModel} from "@angular/forms";
import {
  MatButtonModule,
  MatCardModule,
  MatFormFieldModule,
  MatIconModule,
  MatListModule,
  MatSelectModule,
  MatToolbarModule,
  MatTooltip,
  MatTooltipModule
} from "@angular/material";
import {By} from "@angular/platform-browser";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {RouterTestingModule} from "@angular/router/testing";
import {PreferencesService} from "@spica-client/core";
import {of} from "rxjs";
import {SettingsComponent} from "./settings.component";

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
      update: jasmine.createSpy("update")
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
        RouterTestingModule,
        NoopAnimationsModule,
        FormsModule
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
      fixture.debugElement.query(By.css("mat-list mat-list-item:last-of-type h4")).nativeElement
        .textContent
    ).toBe("Turkish (tr_TR)");
    expect(
      fixture.debugElement.query(By.css("mat-list mat-list-item:last-of-type mat-icon"))
        .nativeElement.classList
    ).toContain("mat-warn");
    expect(
      fixture.debugElement
        .query(By.css("mat-list mat-list-item:last-of-type mat-icon"))
        .injector.get(MatTooltip).disabled
    ).toBe(false);

    expect(
      fixture.debugElement.query(By.css("mat-list mat-list-item:first-of-type h4")).nativeElement
        .textContent
    ).toBe("English (en_US)");
    expect(
      fixture.debugElement.query(By.css("mat-list mat-list-item:first-of-type mat-icon"))
        .nativeElement.classList
    ).not.toContain("mat-warn");
    expect(
      fixture.debugElement
        .query(By.css("mat-list mat-list-item:first-of-type mat-icon"))
        .injector.get(MatTooltip).disabled
    ).toBe(true);

    expect(preferenceService.get).toHaveBeenCalledTimes(1);
    expect(preferenceService.get).toHaveBeenCalledWith("bucket");
  });

  it("should disable add button if language exists", () => {
    const model = fixture.debugElement.query(By.directive(NgModel)).injector.get(NgModel);
    model.reset("tr_TR");
    fixture.detectChanges();
    expect(
      fixture.debugElement.query(By.css("mat-card-content button")).nativeElement.disabled
    ).toBe(true);

    model.reset("ar");
    fixture.detectChanges();
    expect(
      fixture.debugElement.query(By.css("mat-card-content button")).nativeElement.disabled
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

  it("should update settings", () => {
    fixture.componentInstance.addLanguage("af");
    fixture.debugElement.query(By.css("mat-card-actions button")).nativeElement.click();
    expect(preferenceService.update).toHaveBeenCalledTimes(1);
    expect(preferenceService.update).toHaveBeenCalledWith({
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
