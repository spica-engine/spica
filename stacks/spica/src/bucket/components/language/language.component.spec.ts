import {ComponentFixture, TestBed} from "@angular/core/testing";
import {MatButtonModule} from "@angular/material/button";
import {MatIconModule} from "@angular/material/icon";
import {MatMenuModule} from "@angular/material/menu";
import {By} from "@angular/platform-browser";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {of} from "rxjs";
import {BucketService} from "../../services/bucket.service";
import {PropertyLanguageComponent} from "./language.component";

describe("LanguageComponent", () => {
  let component: PropertyLanguageComponent;
  let fixture: ComponentFixture<PropertyLanguageComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MatButtonModule, MatMenuModule, MatIconModule, NoopAnimationsModule],
      providers: [
        {
          provide: BucketService,
          useValue: {
            getPreferences: jasmine.createSpy("getPreferences").and.returnValue(
              of({
                language: {
                  available: {
                    tr_TR: "Turkish",
                    en_US: "English"
                  },
                  default: "en_US"
                }
              })
            )
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
    expect(component.selected).toBe("en_US");
    expect(component.default).toBe("en_US");

    const compiled = document.body;

    expect(
      Array.from(
        compiled.querySelectorAll<HTMLButtonElement>(".mat-mdc-menu-content > button")
      ).map((b: HTMLButtonElement) => b.textContent)
    ).toEqual([" TU ", " EN "], "should work if defined language names rendered correctly ");

    expect(compiled.querySelector(".mat-mdc-menu-content > button.mat-accent")!.textContent).toBe(
      " EN ",
      "should work if there is only single accent button"
    );
  });

  // fit("should change language", () => {
  //   const button = fixture.debugElement.query(By.css("button"));
  //   button.nativeElement.click();
  //   fixture.detectChanges();

  //   const compiled = document.body;

  //   const enLangButton = compiled.querySelector(".mat-mdc-menu-content > button:first-of-type");
  //   expect(enLangButton!.classList).toContain("mat-mdc-primary");

  //   enLangButton!.dispatchEvent(new Event("click"));
  //   fixture.detectChanges();
  //   expect(fixture.componentInstance.selected).toBe("tr_TR");
  //   expect(enLangButton!.classList).toContain(
  //     "mat-accent",
  //     "expected Turkish button to be current"
  //   );
  //   expect(
  //     compiled.querySelector(".mat-mdc-menu-content > button:last-of-type")!.classList
  //   ).toContain("mat-mdc-primary", "expected English button not to be current");
  // });
});
