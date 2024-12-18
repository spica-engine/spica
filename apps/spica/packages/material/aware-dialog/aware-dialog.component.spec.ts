import {Component, TemplateRef, ViewChild} from "@angular/core";
import {ComponentFixture, TestBed} from "@angular/core/testing";
import {FormsModule} from "@angular/forms";
import {MatDialogModule, MatDialogRef, MAT_DIALOG_DATA} from "@angular/material/dialog";
import {MatFormFieldModule} from "@angular/material/form-field";
import {MatIconModule} from "@angular/material/icon";
import {MatInputModule} from "@angular/material/input";
import {BrowserAnimationsModule} from "@angular/platform-browser/animations";
import {MatAwareDialogComponent} from "./aware-dialog.component";

describe("Aware Dialog Component", () => {
  describe("should work with basic matdialogdata", () => {
    let dialogRef: jest.Mocked<MatDialogRef<any, any>> = {
      'close': jest.fn()
    };
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
            useValue: dialogRef
          }
        ],
        declarations: [MatAwareDialogComponent]
      });
      fixture = TestBed.createComponent(MatAwareDialogComponent);
      fixture.detectChanges();
    });

    it("should render aware dialog component", () => {
      const compiled = fixture.debugElement.nativeElement;
      expect(compiled.querySelector("h4 > mat-icon").textContent).toBe("icon");
      expect(compiled.querySelector("h4 > span").textContent).toBe("title");
      expect(compiled.querySelector("mat-dialog-content").textContent).toContain("description");
      expect(compiled.querySelector("mat-dialog-content > mat-form-field").textContent).toBe(
        "hint"
      );
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
      expect(compiled.querySelector("mat-dialog-actions > button:last-of-type").disabled).toBe(
        false
      );
    });

    it("should keep showing disabled confirm button if answer is wrong", async () => {
      const input = fixture.debugElement.nativeElement.querySelector("input");
      input.value = "wrong answer";
      input.dispatchEvent(new Event("input"));
      fixture.detectChanges();
      await fixture.whenStable();
      const compiled = fixture.debugElement.nativeElement;
      expect(compiled.querySelector("mat-dialog-actions > button:last-of-type").disabled).toBe(
        true
      );
    });

    it("should call close method with true", async () => {
      const confirmButton = fixture.debugElement.nativeElement.querySelector(
        "mat-dialog-actions > button:last-of-type"
      );
      const input = fixture.debugElement.nativeElement.querySelector("input");
      input.value = "answer";
      input.dispatchEvent(new Event("input"));
      fixture.detectChanges();
      confirmButton.click();
      expect(dialogRef.close).toHaveBeenCalledWith(true);
    });

    it("should call close method with false", async () => {
      const confirmButton = fixture.debugElement.nativeElement.querySelector(
        "mat-dialog-actions > button:first-of-type"
      );
      const input = fixture.debugElement.nativeElement.querySelector("input");
      input.value = "answer";
      input.dispatchEvent(new Event("input"));
      fixture.detectChanges();
      confirmButton.click();
      expect(dialogRef.close).toHaveBeenCalledWith(false);
    });
  });

  describe("should work with TemplateRef", () => {
    @Component({
      template: `
        <ng-template>
          <p>This is my special template</p>
        </ng-template>
      `
    })
    class TemplateComponent {
      @ViewChild(TemplateRef, {static: true}) templ: TemplateRef<any>;
    }

    let fixture: ComponentFixture<MatAwareDialogComponent>;
    let component: MatAwareDialogComponent;

    beforeEach(() => {
      TestBed.configureTestingModule({declarations: [TemplateComponent]}).compileComponents();

      const tpl = TestBed.createComponent(TemplateComponent);
      tpl.detectChanges();

      TestBed.resetTestingModule()
        .configureTestingModule({
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
                title: "111",
                templateOrDescription: tpl.componentInstance.templ
              }
            },
            {
              provide: MatDialogRef,
              useValue: {}
            }
          ],
          declarations: [MatAwareDialogComponent]
        })
        .compileComponents();

      fixture = TestBed.createComponent(MatAwareDialogComponent);
      component = fixture.componentInstance;

      fixture.detectChanges();
    });

    it("should create component", () => {
      expect(component).toBeDefined();
      expect(component.isTemplate).toBe(true);
    });

    it("should show custom template", () => {
      const template = fixture.debugElement.nativeElement.querySelector(
        "mat-dialog-content > :not(mat-form-field)"
      );
      expect(template.textContent).toBe("This is my special template");
    });
  });
});
