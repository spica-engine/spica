import {PropertyLanguageComponent} from "./language.component";
import {TestBed, ComponentFixture} from "@angular/core/testing";
import {MatButtonModule} from "@angular/material/button";
import {MatMenuModule} from "@angular/material/menu";
import {MatIconModule} from "@angular/material/icon";
import {BucketService} from "../../services/bucket.service";
import {of} from "rxjs";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {By} from "@angular/platform-browser";

describe("LanguageComponent", () => {
  let component: PropertyLanguageComponent;
  let fixture: ComponentFixture<PropertyLanguageComponent>;

  let languagePrefs = {
    language: {
      supported_languages: [{code: "tr_TR", name: "Turkish"}, {code: "en_US", name: "English"}],
      default: {code: "en_US", name: "English"}
    }
  };

  let defaultLanguage = languagePrefs.language.default;
  let supported_languages = languagePrefs.language.supported_languages;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MatButtonModule, MatMenuModule, MatIconModule, NoopAnimationsModule],
      providers: [
        {
          provide: BucketService,
          useValue: {
            getPreferences: jasmine.createSpy("getPreferences").and.returnValue(of(languagePrefs))
          }
        }
      ],
      declarations: [PropertyLanguageComponent]
    }).compileComponents();
    fixture = TestBed.createComponent(PropertyLanguageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should show language options", () => {
    const button = fixture.debugElement.query(By.css("button"));
    button.nativeElement.click();
    fixture.detectChanges();

    let bucketService = TestBed.get(BucketService);
    expect(bucketService.getPreferences).toHaveBeenCalledTimes(1);
    expect(component.selected).toBe(defaultLanguage.code);
    expect(component.default).toBe(defaultLanguage.code);

    const compiled = document.body;

    expect(
      Array.from(compiled.querySelectorAll(".mat-menu-content > button")).map(
        (b: HTMLButtonElement) => b.textContent
      )
    ).toEqual([" TU ", " EN "], "should work if defined language names rendered correctly ");

    expect(compiled.querySelector(".mat-menu-content > button.mat-accent").textContent).toBe(
      " EN ",
      "should work if there is only single accent button"
    );
  });

  it("should change language", () => {
    const button = fixture.debugElement.query(By.css("button"));
    button.nativeElement.click();
    fixture.detectChanges();

    const compiled = document.body;

    const enLangButton = compiled.querySelector(".mat-menu-content > button:first-of-type");
    expect(enLangButton.classList).toContain("mat-primary");

    enLangButton.dispatchEvent(new Event("click"));
    fixture.detectChanges();
    expect(fixture.componentInstance.selected).toBe('tr_TR');
    expect(enLangButton.classList).toContain(
      "mat-accent",
      "expected Turkish button to be current"
    );
    expect(compiled.querySelector(".mat-menu-content > button:last-of-type").classList).toContain(
      "mat-primary",
      "expected English button not to be current"
    );
  });
});
