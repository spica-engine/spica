import {TestBed, ComponentFixture} from "@angular/core/testing";
import {RichTextEditorComponent} from "./richtext";
import {
  MatTooltipModule,
  MatIconModule,
  MatOptionModule,
  MatSelectModule,
  MatTooltip,
  MatDialog
} from "@angular/material";
import {FormsModule, NgModel} from "@angular/forms";
import {PickerDirective} from "src/storage/components/picker/picker.directive";
import {INPUT_SCHEMA} from "@spica-server/common";
import {NoopAnimationsModule} from "@angular/platform-browser/animations";
import {By} from "@angular/platform-browser";

describe("RichTextEditorComponent", () => {
  let fixture: ComponentFixture<RichTextEditorComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        MatTooltipModule,
        MatIconModule,
        FormsModule,
        MatOptionModule,
        MatSelectModule,
        NoopAnimationsModule
      ],
      providers: [
        {
          provide: INPUT_SCHEMA,
          useValue: {
            title: "title",
            description: "description"
          }
        },
        {
          provide: MatDialog,
          useValue: {
            open: jasmine.createSpy("open")
          }
        }
      ],
      declarations: [RichTextEditorComponent, PickerDirective]
    }).compileComponents();
    fixture = TestBed.createComponent(RichTextEditorComponent);

    fixture.detectChanges();
  });

  it("should show schema title and description", () => {
    expect(fixture.debugElement.query(By.css("header h5")).nativeElement.textContent).toBe("Title");
    expect(fixture.debugElement.query(By.css("header small")).nativeElement.textContent).toBe(
      "description"
    );
  });

  it("should render component", () => {
    const actionButton = fixture.debugElement.query(By.css("header button"));
    expect(actionButton.injector.get(MatTooltip).message).toBe("Show more actions");

    expect(
      fixture.debugElement.queryAll(By.directive(NgModel))[0].injector.get(NgModel).model
    ).toBe("Arial", "should work if default font is arial");

    expect(
      fixture.debugElement.queryAll(By.directive(NgModel))[1].injector.get(NgModel).model
    ).toBe("p", "should work if default format is p");

    expect(
      fixture.debugElement.queryAll(By.directive(NgModel))[2].injector.get(NgModel).model
    ).toBe(5, "should work if default font size is 5");
  });

  it("should show more actions", () => {
    const actionButton = fixture.debugElement.query(By.css("header button"));
    actionButton.nativeElement.click();
    fixture.detectChanges();
    expect(actionButton.injector.get(MatTooltip).message).toBe("Show less actions");
    expect(fixture.componentInstance.moreActions).toBe(true);
  });

  it("should show fonts", () => {
    fixture.debugElement.query(By.css(".actions mat-select:nth-child(1)")).nativeElement.click();
    fixture.detectChanges();
    expect(
      Array.from(document.body.querySelectorAll<HTMLElement>("mat-option")).map(
        (o: HTMLElement) => o.textContent
      )
    ).toEqual([" Arial ", " Times New Roman ", " Calibri ", " Comic Sans MS "]);
  });

  it("should show formats", () => {
    fixture.debugElement.queryAll(By.css(".actions mat-select"))[1].nativeElement.click();
    fixture.detectChanges();
    expect(
      Array.from(document.body.querySelectorAll<HTMLElement>("mat-option")).map(
        (o: HTMLElement) => o.textContent
      )
    ).toEqual([
      " Heading 1 ",
      " Heading 2 ",
      " Heading 3 ",
      " Heading 4 ",
      " Heading 5 ",
      " Heading 6 ",
      " Paragraph ",
      " Predefined "
    ]);
  });

  it("should select text color ", () => {
    const colorSpy = spyOn(fixture.componentInstance, "setTextColor");
    const colorInput = fixture.debugElement.query(By.css(".actions span:nth-child(2) input"))
      .nativeElement;
    colorInput.value = "#111111";
    colorInput.dispatchEvent(new Event("change"));
    fixture.detectChanges();

    expect(colorSpy).toHaveBeenCalledTimes(1);
    expect(colorSpy).toHaveBeenCalledWith("#111111");
  });

  it("should select background color ", () => {
    const colorSpy = spyOn(fixture.componentInstance, "setBackgroundColor");
    const colorInput = fixture.debugElement.query(
      By.css(".actions span:nth-child(2) button:last-of-type input")
    ).nativeElement;
    colorInput.value = "#ffffff";
    colorInput.dispatchEvent(new Event("change"));
    fixture.detectChanges();

    expect(colorSpy).toHaveBeenCalledTimes(1);
    expect(colorSpy).toHaveBeenCalledWith("#ffffff");
  });
});
