import {ComponentFixture, TestBed, tick, fakeAsync, waitForAsync} from "@angular/core/testing";
import {StrategyDialogComponent} from "./strategy-dialog.component";
import {MatProgressSpinnerModule} from "@angular/material/progress-spinner";
import {MAT_DIALOG_DATA} from "@angular/material/dialog";
import {By} from "@angular/platform-browser";

describe("StrategyDialogComponent", () => {
  let component: StrategyDialogComponent;
  let fixture: ComponentFixture<StrategyDialogComponent>;
  let data: any;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [StrategyDialogComponent],
      imports: [MatProgressSpinnerModule],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: (data = {url: "about:blank"})
        }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(StrategyDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("should set src of the iframe from dialog data", () => {
    expect(fixture.debugElement.query(By.css("iframe")).nativeElement.src).toBe("about:blank");
  });

  it("should set opacity of the iframe to one when the iframe is ready", () => {
    fixture.componentInstance.loaded = true;
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css("iframe")).styles.opacity).toBe("1");
  });

  it("should set opacity of the iframe to zero when the iframe is not ready", () => {
    fixture.componentInstance.loaded = false;
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css("iframe")).styles.opacity).toBe("0");
  });

  it("should show the progress spinner when the iframe is not ready", () => {
    fixture.componentInstance.loaded = false;
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css("mat-progress-spinner"))).toBeTruthy();
  });
});
