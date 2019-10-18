import {TestBed, ComponentFixture, async} from "@angular/core/testing";
import {MatAwareDialogComponent} from "./aware-dialog.component";
import {MatIconModule} from "@angular/material/icon";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatDialogModule, MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog";
import {FormsModule} from "@angular/forms";
import {MatInputModule} from "@angular/material/input";
import {BrowserAnimationsModule} from "@angular/platform-browser/animations";
import {TemplateRef, ViewChild} from "@angular/core";

// TODO(tuna): Also, test template feature

describe("Aware Dialog Component", () => {
  let component: MatAwareDialogComponent;
  let fixture: ComponentFixture<MatAwareDialogComponent>;
  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [
        BrowserAnimationsModule,
        MatInputModule,
        MatIconModule,
        MatFormFieldModule,
        MatDialogModule,
        FormsModule
      ],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            icon: "icon",
            title: "title",
            templateOrDescription: "description",
            answer: "answer",
            answerHint: "hint",
            confirmText: "confirm",
            cancelText: "cancel"
          }
        },
        {
          provide: MatDialogRef,
          useValue: {}
        }
      ],
      declarations: [MatAwareDialogComponent]
    });
    fixture = TestBed.createComponent(MatAwareDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it("should render aware dialog component", () => {
    const compiled = fixture.debugElement.nativeElement;
    expect(compiled.querySelector("h4 > mat-icon").textContent).toBe("icon");
    expect(compiled.querySelector("h4 > span").textContent).toBe("title");
    expect(compiled.querySelector("mat-dialog-content").textContent).toContain("description");
    expect(compiled.querySelector("mat-dialog-content > mat-form-field").textContent).toBe("hint");
    expect(compiled.querySelector("mat-dialog-actions > button:first-of-type").textContent).toBe(
      " cancel "
    );
    expect(compiled.querySelector("mat-dialog-actions > button:last-of-type").textContent).toBe(
      " confirm "
    );
    expect(
      compiled.querySelector("mat-dialog-actions > button:last-of-type").disabled
    ).toBeTruthy();
  });

  it("should render enabled confirm button if answer is correct ", async () => {
    const input = fixture.debugElement.nativeElement.querySelector("input");
    input.value = "answer";
    input.dispatchEvent(new Event("input"));
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.debugElement.nativeElement;
    expect(compiled.querySelector("mat-dialog-actions > button:last-of-type").disabled).toBe(false);
  });

  it("should keep showing disabled confirm button if answer is wrong", async () => {
    const input = fixture.debugElement.nativeElement.querySelector("input");
    input.value = "wrong answer";
    input.dispatchEvent(new Event("input"));
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.debugElement.nativeElement;
    expect(compiled.querySelector("mat-dialog-actions > button:last-of-type").disabled).toBe(true);
  });
});
