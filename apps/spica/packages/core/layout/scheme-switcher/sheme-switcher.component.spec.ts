import {SchemeSwitcherComponent} from "./scheme-switcher.component";
import {ComponentFixture, TestBed, waitForAsync} from "@angular/core/testing";
import {MatTooltipModule} from "@angular/material/tooltip";
import {MatIconModule} from "@angular/material/icon";
import {SchemeObserver, Scheme} from "../scheme.observer";
import {of} from "rxjs";

describe("Scheme Switcher Component", () => {
  describe("Dark Theme as Default", () => {
    let component: SchemeSwitcherComponent;
    let fixture: ComponentFixture<SchemeSwitcherComponent>;

    beforeEach(
      waitForAsync(() => {
        TestBed.configureTestingModule({
          declarations: [SchemeSwitcherComponent],
          imports: [MatTooltipModule, MatIconModule],
          providers: [
            {
              provide: SchemeObserver,
              useValue: {
                observe: jest.fn(() => of(true)),
                setScheme: jest.fn(),
                isMatched: jest.fn(() => true)
              }
            }
          ]
        }).compileComponents();
        fixture = TestBed.createComponent(SchemeSwitcherComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
      })
    );

    it("should be dark theme as default", () => {
      expect(
        fixture.debugElement.nativeElement
          .querySelector(".switcher")
          .getAttribute("ng-reflect-message")
      ).toBe("Switch to light theme.");
      expect(
        fixture.debugElement.nativeElement.querySelector(".switcher mat-icon").textContent
      ).toBe("nights_stay");
    });

    it("should pass the Scheme.Light to setscheme method when button clicked", () => {
      fixture.debugElement.nativeElement.querySelector(".switcher").click();
      expect(component["schemeObserver"].setScheme).toHaveBeenCalledTimes(1);
      expect(component["schemeObserver"].setScheme).toHaveBeenCalledWith(Scheme.Light);
    });
  });

  describe("Light Theme As Default", () => {
    let component: SchemeSwitcherComponent;
    let fixture: ComponentFixture<SchemeSwitcherComponent>;

    beforeEach(
      waitForAsync(() => {
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
          declarations: [SchemeSwitcherComponent],
          imports: [MatTooltipModule, MatIconModule],
          providers: [
            {
              provide: SchemeObserver,
              useValue: {
                observe: jest.fn(() => of(false)),
                setScheme: jest.fn(),
                isMatched: jest.fn(() => false)
              }
            }
          ]
        }).compileComponents();
        fixture = TestBed.createComponent(SchemeSwitcherComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
      })
    );

    it("should be light theme as default", () => {
      expect(
        fixture.debugElement.nativeElement
          .querySelector(".switcher")
          .getAttribute("ng-reflect-message")
      ).toBe("Switch to dark theme.");
      expect(
        fixture.debugElement.nativeElement.querySelector(".switcher mat-icon").textContent
      ).toBe("wb_sunny");
    });

    it("should pass the Scheme.Dark to setscheme method when button clicked", () => {
      fixture.debugElement.nativeElement.querySelector(".switcher").click();
      expect(component["schemeObserver"].setScheme).toHaveBeenCalledTimes(1);
      expect(component["schemeObserver"].setScheme).toHaveBeenCalledWith(Scheme.Dark);
    });
  });
});
