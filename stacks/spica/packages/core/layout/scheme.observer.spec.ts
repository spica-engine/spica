import {BreakpointObserver} from "@angular/cdk/layout";
import {TestBed, tick, fakeAsync} from "@angular/core/testing";
import {of} from "rxjs";
import {Scheme, SchemeObserver} from "./scheme.observer";

describe("Scheme Observer Test Suit", () => {
  describe("Dark Theme Default", () => {
    let schemeObserver: SchemeObserver;
    let breakpointObserver = {
      observe: jasmine.createSpy("observe").and.returnValue(of({matches: true})),
      isMatched: jasmine.createSpy("isMatched").and.returnValue(true)
    };
    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [
          SchemeObserver,
          {
            provide: BreakpointObserver,
            useValue: breakpointObserver
          }
        ]
      });
      schemeObserver = TestBed.get(SchemeObserver);
    });

    it("should be dark as default", () => {
      expect(schemeObserver.isMatched(Scheme.Dark)).toBeTruthy();
      schemeObserver.observe(Scheme.Dark).subscribe(isDark => {
        expect(isDark).toBeTruthy();
      });
    });

    it("should switch to light theme", () => {
      schemeObserver.setScheme(Scheme.Light);
      expect(schemeObserver.isMatched(Scheme.Light)).toBeTruthy();
      schemeObserver.observe(Scheme.Light).subscribe(isLight => {
        expect(isLight).toBeTruthy();
      });
    });
  });
  describe("Light Theme Default", () => {
    let schemeObserver: SchemeObserver;
    let breakpointObserver = {
      observe: jasmine.createSpy("observe").and.returnValue(of({matches: false})),
      isMatched: jasmine.createSpy("isMatched").and.returnValue(false)
    };
    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [
          SchemeObserver,
          {
            provide: BreakpointObserver,
            useValue: breakpointObserver
          }
        ]
      });
      schemeObserver = TestBed.get(SchemeObserver);
    });

    it("should be light as default", () => {
      expect(schemeObserver.isMatched(Scheme.Light)).toBeTruthy();
      schemeObserver.observe(Scheme.Light).subscribe(isLight => {
        expect(isLight).toBeTruthy();
      });
    });

    it("should switch to dark theme", () => {
      schemeObserver.setScheme(Scheme.Dark);
      expect(schemeObserver.isMatched(Scheme.Dark)).toBeTruthy();
      schemeObserver.observe(Scheme.Dark).subscribe(isDark => {
        expect(isDark).toBeTruthy();
      });
    });
  });
});
